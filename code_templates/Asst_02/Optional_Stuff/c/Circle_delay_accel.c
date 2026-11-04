// Memory this program needs: IROM_DEPTH_BITS 11, DMEM_DEPTH_BITS 9
// (2**11 = 2048 bytes of code, 2**9 = 512 bytes of data). The simulator sets its
// Linker segments from these when you pick the example; set the same two
// localparams in Wrapper.v. Change both if you change the program.

#define MMIO_BASE 0xFFFF0000   // Should be the same as the .mmio address based on the Memory Configuration set in the assembler/linker, and Wrapper.v

// Memory-mapped peripheral register offsets
#define UART_RX_VALID_OFF	0x00 //RO, status bit
#define UART_RX_OFF 		0x04 //RO
#define UART_TX_READY_OFF	0x08 //RO, status bit
#define UART_TX_OFF 		0x0C //WO
#define OLED_COL_OFF 		0x20 //WO
#define OLED_ROW_OFF 		0x24 //WO
#define OLED_DATA_OFF 		0x28 //WO
#define OLED_CTRL_OFF 		0x2C //WO
#define OLED_STATUS_OFF 	0x30 //RO, status bit
#define OLED_SWAP 			0x08 //write this to OLED_CTRL to present the drawn frame
#define ACCEL_DATA_OFF 		0x40 //RO
#define ACCEL_DREADY_OFF 	0x44 //RO, status bit
#define LED_OFF 			0x60 //WO
#define DIP_OFF 			0x64 //RO
#define PB_OFF  			0x68 //RO
#define SEVENSEG_OFF 		0x80 //WO
#define CYCLECOUNT_OFF 		0xA0 //RO
// Not using ACCEL_DREADY_OFF as we poll at a low freq, should be ready

void drawFilledMidpointCircleSinglePixelVisit(int centerX, int centerY, int radius, unsigned int colour);
void drawHorizontalLine(int startX, int endX, int Y, unsigned int colour);
void delay(unsigned int cycles);
volatile unsigned int* CYCLECOUNT_ADDR = (unsigned int*) (MMIO_BASE+CYCLECOUNT_OFF); 
// making CYCLECOUNT_ADDR global just to use data memory :)

int main()
{
    volatile unsigned int* ACCEL_Data_ADDR = (unsigned int*) (MMIO_BASE+ACCEL_DATA_OFF); // temp, x, y, z
    volatile unsigned int* UART_TX_ready_ADDR = (unsigned int*) (MMIO_BASE+UART_TX_READY_OFF);
    volatile unsigned int* UART_TX_ADDR = (unsigned int*) (MMIO_BASE+UART_TX_OFF);
    volatile unsigned int* SEVENSEG_ADDR = (unsigned int*) (MMIO_BASE+SEVENSEG_OFF);
    volatile unsigned int* OLED_CTRL_ADDR = (unsigned int*) (MMIO_BASE+OLED_CTRL_OFF);
    volatile unsigned int* OLED_STATUS_ADDR = (unsigned int*) (MMIO_BASE+OLED_STATUS_OFF);
    const char *msg = "Tilt in various directions to see the colour change\r\n";
    for (int k = 0; msg[k] != '\0'; k++) {
        while (!(*UART_TX_ready_ADDR)); // wait for UART to be ready
        *UART_TX_ADDR = msg[k];
    }

    while(1)
    {
        unsigned int accel_reading = *ACCEL_Data_ADDR;
        unsigned int accel_reading_mag = 0;
        int accel_reading_mag_byte = 0;

        // display the magnitude on seven segment display
        *SEVENSEG_ADDR = accel_reading;

        // Calculate magnitude
        for(int i=24; i>=0; i-=8) 
        {
            accel_reading_mag_byte = ( accel_reading << (24-i) ) & 0xFF000000;
            if(accel_reading_mag_byte<0)    // find magnitude
            {
                accel_reading_mag_byte = -accel_reading_mag_byte;
            }
            // accel_reading_mag_byte is +ve at this point. Right shift logical = arith
            accel_reading_mag += ( accel_reading_mag_byte >> (24-i) );
        }

        // using accel value directly. 2g+-2g range, so multiply mag by 2 (<<1) to have full brightness at 1g
        drawFilledMidpointCircleSinglePixelVisit(48, 32, 28, accel_reading_mag << 1); 

        // Present the frame we just drew. Without this the circle is redrawn
        // into the page the display is scanning out, and you see it half
        // updated. The wait is what makes the exchange land between frames;
        // the controller copies the presented page back afterwards, which is
        // why only the circle needs redrawing and not the whole screen.
        *OLED_CTRL_ADDR = OLED_SWAP;
        while (*OLED_STATUS_ADDR & 1);
        
        // Original hardware delay: 1,000,000 cycles (~10ms at 100MHz)
        // delay(1000000);
        // Reduced delay value for high-speed real-time simulation:
        delay(50); // Reduced delay value for high-speed simulation
    }
    return 0;
}

void drawFilledMidpointCircleSinglePixelVisit(int centerX, int centerY, int radius, unsigned int colour)
{
// Function Courtesy: https://stackoverflow.com/a/24527943
    int x = radius;
    int y = 0;
    int radiusError = 1 - x;

    while (x >= y)  // iterate to the circle diagonal
    {
        // use symmetry to draw the two horizontal lines at this Y with a special case to draw
        // only one line at the centerY where y == 0
        int startX = -x + centerX;
        int endX = x + centerX;
        drawHorizontalLine( startX, endX, y + centerY, colour );
        if (y != 0)
        {
            drawHorizontalLine( startX, endX, -y + centerY, colour );
        }

        // move Y one line
        y++;

        // calculate or maintain new x
        if (radiusError<0)
        {
            radiusError += 2 * y + 1;
        }
        else 
        {
            // we're about to move x over one, this means we completed a column of X values, use
            // symmetry to draw those complete columns as horizontal lines at the top and bottom of the circle
            // beyond the diagonal of the main loop
            if (x >= y)
            {
                startX = -y + 1 + centerX;
                endX = y - 1 + centerX;
                drawHorizontalLine( startX, endX,  x + centerY, colour);
                drawHorizontalLine( startX, endX, -x + centerY, colour );
            }
            x--;
            radiusError += 2 * (y - x + 1);
        }
    }
}

void drawHorizontalLine(int startX, int endX, int Y, unsigned int colour)
{
    volatile unsigned int* OLED_ROW_ADDR = (unsigned int*) (MMIO_BASE + OLED_ROW_OFF);
    volatile unsigned int* OLED_COL_ADDR = (unsigned int*) (MMIO_BASE + OLED_COL_OFF);
    volatile unsigned int* OLED_DATA_ADDR = (unsigned int*) (MMIO_BASE + OLED_DATA_OFF);
    volatile unsigned int* OLED_CTRL_ADDR = (unsigned int*) (MMIO_BASE + OLED_CTRL_OFF);

    *OLED_ROW_ADDR = Y; // Y
    // 24-bit mode (allows acc data directly), varying x (COL)
    *OLED_CTRL_ADDR = 0x21;
    *OLED_DATA_ADDR = colour;
    for(int i=startX; i<=endX; i++)
    {
        *OLED_COL_ADDR = i;
    }
}

void delay(unsigned int cycles)
{
    unsigned int starting_count = *CYCLECOUNT_ADDR;
    while(*CYCLECOUNT_ADDR < starting_count + cycles);
}

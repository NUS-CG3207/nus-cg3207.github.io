// DIP switches mirrored to LEDs, continuously (C translation of DIP_to_LED.asm)

// Memory this program needs: IROM_DEPTH_BITS 9, DMEM_DEPTH_BITS 9
// (2**9 = 512 bytes of code, 2**9 = 512 bytes of data). The simulator sets its
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
#define ACCEL_DATA_OFF 		0x40 //RO
#define ACCEL_DREADY_OFF 	0x44 //RO, status bit
#define LED_OFF 			0x60 //WO
#define DIP_OFF 			0x64 //RO
#define PB_OFF  			0x68 //RO
#define SEVENSEG_OFF 		0x80 //WO
#define CYCLECOUNT_OFF 		0xA0 //RO

#define DELAY_COUNT 4 // matches the wait loop in DIP_to_LED.asm

int main()
{
    volatile unsigned int* DIP_ADDR = (unsigned int*) (MMIO_BASE+DIP_OFF);
    volatile unsigned int* LED_ADDR = (unsigned int*) (MMIO_BASE+LED_OFF);

    while (1)
    {
        *LED_ADDR = *DIP_ADDR;   // mirror the switches onto the LEDs

        // small delay before sampling again, so the LEDs are not being
        // rewritten on literally every cycle
        for (volatile unsigned int i = DELAY_COUNT; i > 0; i--);
    }
    return 0;
}

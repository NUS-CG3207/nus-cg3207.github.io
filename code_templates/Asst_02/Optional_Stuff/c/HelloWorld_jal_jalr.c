// UART command echo, greeting printed by a function taking a parameter
// (C translation of HelloWorld_jal_jalr.asm)

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

#define UART_RX_VALID_ADDR ((volatile unsigned int*) (MMIO_BASE+UART_RX_VALID_OFF))
#define UART_RX_ADDR       ((volatile unsigned int*) (MMIO_BASE+UART_RX_OFF))
#define UART_TX_READY_ADDR ((volatile unsigned int*) (MMIO_BASE+UART_TX_READY_OFF))
#define UART_TX_ADDR       ((volatile unsigned int*) (MMIO_BASE+UART_TX_OFF))
#define LED_ADDR            ((volatile unsigned int*) (MMIO_BASE+LED_OFF))
#define SEVENSEG_ADDR       ((volatile unsigned int*) (MMIO_BASE+SEVENSEG_OFF))

// Prints a null-terminated string to UART only, one character at a time -
// the C equivalent of the PRINT_S subroutine in HelloWorld_jal_jalr.asm,
// which is called with the string's address in a0 (`la a0, string1` then
// `jal PRINT_S`). Here that argument is just `s`, passed the ordinary way.
void print_string(const char *s)
{
    for (int k = 0; s[k] != '\0'; k++) {
        while (!(*UART_TX_READY_ADDR));
        *UART_TX_ADDR = s[k];
    }
}

int main()
{
    const char *greeting = "\r\nWelcome to CG3207..\r\n";
    unsigned int c;
    int gotA = 0;   // 0 = waiting for 'A' (WAIT_A); 1 = 'A' seen, waiting for Enter (WAIT_CRorLF)

    while (1)
    {
        while (!(*UART_RX_VALID_ADDR));
        c = *UART_RX_ADDR;
        while (!(*UART_TX_READY_ADDR));
        *UART_TX_ADDR = c;
        *SEVENSEG_ADDR = c;
        *LED_ADDR = c;

        if (c == 'A') {
            gotA = 1;
        } else if (gotA && (c == '\r' || c == '\n')) {
            print_string(greeting);   // the jal PRINT_S / ret call
            gotA = 0;
        } else {
            gotA = 0;
        }
    }
    return 0;
}

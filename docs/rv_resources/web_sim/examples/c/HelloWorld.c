/*
----------------------------------------------------------------------------------
--	MIT License
--
--	Copyright (c) 2020 Rajesh Panicker
--
--	Permission is hereby granted, free of charge, to any person obtaining a copy
--	of this software and associated documentation files (the "Software"), to deal
--	in the Software without restriction, including without limitation the rights
--	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
--	copies of the Software, and to permit persons to whom the Software is
--	furnished to do so, subject to the following conditions:
--
--	The above copyright notice and this permission notice shall be included in all
--	copies or substantial portions of the Software.
--
--	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
--	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
--	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
--	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
--	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
--	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
--	SOFTWARE.
--
--	Not a condition of the license, but if you find this code useful, an email to
--	rajesh.panicker <at> u.nus.edu briefly mentioning its use would be appreciated.
----------------------------------------------------------------------------------
*/

// UART command echo: type A then Enter for a greeting (C translation of HelloWorld.asm)

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

// No callee function here, on purpose - matching HelloWorld.asm, which
// predates jal/jalr in the course and inlines everything into main. See
// HelloWorld_jal_jalr.c for the version with a real function call.
int main()
{
    const char *greeting = "\r\nWelcome to CG3207..\r\n";
    unsigned int c;
    // 0 = still waiting for 'A' (WAIT_A); 1 = 'A' seen, waiting for Enter
    // (WAIT_CRorLF). One state variable instead of two copies of the same
    // echo code - HelloWorld.asm can afford the duplication because a jump
    // is free; a C statement written twice is not.
    int gotA = 0;

    while (1)
    {
        // Wait for the next character, echoing it to UART, the 7-segment
        // display and the LEDs - exactly like ECHO_A / ECHO_CRorLF in
        // HelloWorld.asm, which do the same three writes either way.
        while (!(*UART_RX_VALID_ADDR));
        c = *UART_RX_ADDR;
        while (!(*UART_TX_READY_ADDR));
        *UART_TX_ADDR = c;
        *SEVENSEG_ADDR = c;
        *LED_ADDR = c;

        if (c == 'A') {
            gotA = 1;                              // (repeated) 'A' - keep waiting for Enter
        } else if (gotA && (c == '\r' || c == '\n')) {
            // "A" then Enter: print the greeting, to UART only - just like
            // PRINT_S in HelloWorld.asm, which never touches the LEDs or
            // the 7-segment display.
            for (int k = 0; greeting[k] != '\0'; k++) {
                while (!(*UART_TX_READY_ADDR));
                *UART_TX_ADDR = greeting[k];
            }
            gotA = 0;
        } else {
            gotA = 0;                              // anything else - start over
        }
    }
    return 0;
}

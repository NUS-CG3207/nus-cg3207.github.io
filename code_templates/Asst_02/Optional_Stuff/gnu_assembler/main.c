// Type your code here, or load an example.
#define MMIO_BASE 0xFFFF0000
// Memory-mapped peripheral register offsets
#define UART_RX_VALID_OFF 			0x00
#define UART_RX_OFF			0x04 //RO
#define UART_TX_READY_OFF			0x08 //RO, status bit
#define UART_TX_OFF			0x0C //WO
#define OLED_COL_OFF			0x20 //WO
#define OLED_ROW_OFF			0x24 //WO
#define OLED_DATA_OFF			0x28 //WO
#define OLED_CTRL_OFF			0x2C //WO
#define ACCEL_DATA_OFF			0x40 //RO
#define ACCEL_DREADY_OFF			0x44 //RO, status bit
#define DIP_OFF				0x64 //RO
#define PB_OFF				0x68 //RO
#define LED_OFF				0x60 //WO
#define SEVENSEG_OFF			0x80 //WO
#define CYCLECOUNT_OFF			0xA0 //RO



#define HAL_SEVENSEG(out)   *(int *)(MMIO_BASE+SEVENSEG_OFF)=(out)
#define HAL_CYCLECOUNT()    *(int *)(MMIO_BASE+CYCLECOUNT_OFF)
#define HAL_UART_TX_READY() *UART_TX_READY
#define HAL_UART_TX(out)    *(int *)(MMIO_BASE+UART_TX_OFF)=(out)
#define HAL_UART_RX()       *(int *)(MMIO_BASE+UART_RX_OFF)
#define HAL_UART_RX_VALID() *UART_RX_VALID

void test();

int main() {   
    volatile char *UART_TX_READY = (int*) (MMIO_BASE+UART_TX_READY_OFF);
    volatile char *UART_RX_VALID = (int*) (MMIO_BASE+UART_RX_VALID_OFF);
    
    HAL_SEVENSEG(0x12345678);
    while (1) {
        if (HAL_CYCLECOUNT() < 100){ break; }
    }
    HAL_SEVENSEG(0xDEADBEEF);
    
    while (!HAL_UART_TX_READY()) {}
    HAL_UART_TX(0x41);
    while (!HAL_UART_TX_READY()) {}
    HAL_UART_TX(0x42);
    while (!HAL_UART_TX_READY()) {}
    HAL_UART_TX(0x43);
    while (!HAL_UART_TX_READY()) {}
    HAL_UART_TX(0x44);
    while (!HAL_UART_TX_READY()) {}
    HAL_UART_TX(0x45);
    test();

    while (1) {} // end;
}

void test(){
    HAL_SEVENSEG(0xDEADDEAD);
}
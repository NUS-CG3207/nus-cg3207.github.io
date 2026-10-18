---
nav_exclude: true
---
# ARM Memory Map

## Memory Map of OUR\* ARM Processor

\*This memory map is not compliant with any standards/recommendations. It is just the choice/design of the CG3207 lecturer.

| Address                     | Attributes      | DESCRIPTION |
|-----------------------------|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0x00000000 to 0x000001FC    | RO (Read Only)  | Instruction memory (ROM). 128 words. Word addressable - only multiples of 4 are valid addresses. This might cause warnings about 2 unused bits, but that's ok.|
| 0x00000200 to 0x000003FC    | RO              | Data (Constant) memory (ROM). 128 words. Word addressable - only multiples of 4 are valid addresses.|
| 0x00000800 to 0x000009FC    | RW (Read/Write) | Data (Variable) memory (RAM). 128 words. Word addressable - only multiples of 4 are valid addresses.|
| 0x00000A00 to 0x00000BFC    | -               | Unused / unmapped.|
| 0x00000C00                  | WO (Write Only) | LED[15:8]. Only the least significant 8 bits written to this location are used. LED[7] is used to show the divided clock. LED[6:0] shows PC[8:2]. PC[1:0] will always be 0 and hence not shown.|
| 0x00000C04                  | RO              | DIP switches. Only the least significant 16 bits read from this location are valid, corresponding to SW[15:0].|
| 0x00000C08                  | RO              | PushButton switches. [2:0] →  BTNL, BTNC, BTNR. Only the least significant 3 bits read from this location are valid. BTND is used as RESET and BTNU is used as PAUSE.|
| 0x00000C0C                  | RW              | UART Console (both in and out). UART Settings: Baud Rate 115200. 8-bit. No Parity. 1 Stop bit. More details are given below. Only the least significant 8 bits in this location can be read/written. |
| 0x00000C10                  | RO              | CONSOLE_IN_valid.|
| 0x00000C14                  | RO              | CONSOLE_OUT_ready.|
| 0x00000C18                  | WO              | 7-Segment LED display. The data written to this location will appear as an 8-digit hexadecimal number on the display. For the Basys 3 board, the two half-words will keep displaying in alternation. |

**Table 1: Memory map summary**

## Endianness

The instruction and data memory are WORD addressable (NOT byte-addressable) for our labs. => Endianness doesn't matter for our hardware. However, the Hex2ROM converter tool assumes a little-endian format by default. Endianness matters only when each byte in the memory has an address, but we read/write one word (4 bytes) in one go. For example, if we store two words 0xABCD1234 and 0xEF567890 in the memory starting at the address 0x00000000, the two words will be stored at word addresses 0x00000000 and 0x00000004 respectively. In a system with a little-endian processor, the byte address 0x00000000 will have the content 0x34, byte address 0x00000001 will have the content 0x12, byte address 0x00000003 will have the content 0xAB, byte address 0x00000004 will have the content 0x90, byte address 0x00000007 will have the content 0xEF. In CG3207 labs, we use a memory that cannot deal with byte addresses such as 0x00000001 and 0x00000002. We can only send word addresses (addresses which are multiples of 4), i.e., like 0x00000000 and 0x00000004, and get the corresponding 32-bit contents. Hence, for our hardware, endianness doesn't matter. However, we need to maintain consistency between our selection in Keil and the Hex2ROM converter tool.

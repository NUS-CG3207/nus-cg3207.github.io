#----------------------------------------------------------------------------------
#--	MIT License
#--
#--	Copyright (c) 2020 Rajesh Panicker
#--
#--	Permission is hereby granted, free of charge, to any person obtaining a copy
#--	of this software and associated documentation files (the "Software"), to deal
#--	in the Software without restriction, including without limitation the rights
#--	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
#--	copies of the Software, and to permit persons to whom the Software is
#--	furnished to do so, subject to the following conditions:
#--
#--	The above copyright notice and this permission notice shall be included in all
#--	copies or substantial portions of the Software.
#--
#--	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
#--	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#--	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
#--	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#--	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
#--	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
#--	SOFTWARE.
#--
#--	Not a condition of the license, but if you find this code useful, an email to
#--	rajesh.panicker <at> u.nus.edu briefly mentioning its use would be appreciated.
#----------------------------------------------------------------------------------

# This sample program for RISC-V simulation using RARS

.eqv MMIO_BASE 0xFFFF0000
# Memory-mapped peripheral register offsets
.eqv UART_RX_VALID_OFF 			0x00 #RO, status bit
.eqv UART_RX_OFF			0x04 #RO
.eqv UART_TX_READY_OFF			0x08 #RO, status bit
.eqv UART_TX_OFF			0x0C #WO
.eqv OLED_COL_OFF			0x20 #WO
.eqv OLED_ROW_OFF			0x24 #WO
.eqv OLED_DATA_OFF			0x28 #WO
.eqv OLED_CTRL_OFF			0x2C #WO
.eqv ACCEL_DATA_OFF			0x40 #RO
.eqv ACCEL_DREADY_OFF			0x44 #RO, status bit
.eqv DIP_OFF				0x64 #RO
.eqv PB_OFF				0x68 #RO
.eqv LED_OFF				0x60 #WO
.eqv SEVENSEG_OFF			0x80 #WO
.eqv CYCLECOUNT_OFF			0xA0 #RO

# ------- <code memory (Instruction Memory ROM) begins>
.text	## IROM segment: IROM_BASE to IROM_BASE+2^IROM_DEPTH_BITS-1
# Total number of real instructions should not exceed 2^IROM_DEPTH_BITS/4 (127 excluding the last line 'halt B halt' if IROM_DEPTH_BITS=9).
# Pseudoinstructions (e.g., li, la) may be implemented using more than one actual instruction. See the assembled code in the Execute tab of RARS.

# You can also use the actual register numbers directly. For example, instead of s1, you can write x9

main:
	li s0, MMIO_BASE		# MMIO_BASE. Implemented as lui+addi
	# Could have done lw s0,MMIO_BASE (ARM style) instead of the li above, provided MMIO_BASE: .word 0xFFFF0000 was declared in the .data (DMEM) section instead of .eqv
	addi s1, s0, LED_OFF		# LED address = MMIO_BASE + LED_OFF
	li  s2, DIP_OFF			# note that this li doesn't translate to lui, unlike the li in line 41.
	add s2, s0, s2			# DIP address = MMIO_BASE + DIP_OFF. Could have been done in a way similar to LED address, but done this way to have a DP reg instruction
loop:
	lw s3, delay_val		# reading the loop counter value
	lw s4, (s2)			# reading DIPS
	sw s4, (s1)			# writing to LEDS

wait:
	addi s3, s3, -1		# subtract 1
	beq s3, zero, loop	# exit the loop
	jal zero, wait		# continue in the loop (could also have written j wait).

halt:	
	j halt		# infinite loop to halt computation. A program should not "terminate" without an operating system to return control to
				# keep halt: j halt as the last line of your code so that there is a 'dead end' beyond which execution will not proceed.
				
# ------- <code memory (Instruction Memory ROM) ends>			
				
								
#------- <Data Memory begins>									
.data  ## DMEM segment: DMEM_BASE to DMEM_BASE+2^DMEM_DEPTH_BITS-1
# Total number of constants+variables should not exceed 2^DMEM_DEPTH_BITS/4 (128 if DMEM_DEPTH_BITS=9).

DMEM:

delay_val: .word 4	# a constant, at location DMEM+0x00
string1:
.asciz "\r\nWelcome to CG3207..\r\n"	# string, from DMEM+0x4 to DMEM+0x18 (word address, including null character. The last character is at a byte address 0x1B). 
var1: .word	1 		# a statically allocated variable (which can have an initial value, say 1), at location DMEM+0x1C    # correction: 0x1C, not 0x20.
# Food for thought: What will be the address of var1 if string1 had one extra character, say  "..." instead of ".."? Hint: words are word-aligned.

.align 9	# To set the address at this point to be 512-byte aligned, i.e., DMEM+0x200
STACK_INIT:	# Stack pointer can be initialised to this location - DMEM+0x200 (i.e., the address of stack_top)
			# stack grows downwards, so stack pointer should be decremented when pushing and incremented when popping (if the stack is full-descending). Stack can be used for function calls and local variables.
		# Not allocating any heap, as it is unlikely to be used in this simple program. If we need dynamic memory allocation,we need to allocate memory and imeplement a heap manager.
#------- <Data Memory ends>													

#----------------------------------------------------------------------------------
#-- (c) Rajesh Panicker
#--	License terms :
#--	You are free to use this code as long as you
#--		(i) DO NOT post it on any public repository;
#--		(ii) use it only for educational purposes;
#--		(iii) accept the responsibility to ensure that your implementation does not violate anyone's intellectual property.
#--		(iv) accept that the program is provided "as is" without warranty of any kind or assurance regarding its suitability for any particular purpose;
#--		(v) send an email to rajesh<dot>panicker<at>ieee.org briefly mentioning its use (except when used for the course CG3207 at the National University of Singapore);
#--		(vi) retain this notice in this file and any files derived from this.
#----------------------------------------------------------------------------------

# This sample program prints "Welcome to CG3207" in response to "A\r" or "A\n" (A+Enter*) received from Console. 
# *Some terminal programs send '\r' (default in TeraTerm), whereas some such as the RARS Keyboard and Display MMIO simulator sends '\n'.
# There should be a sufficient time gap between the press of 'A' and '\r' or '\n'if the processor is run at a low freq.

.eqv LSB_MASK 0xFF # A mask to extract the least significant byte.

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
# Pseudoinstructions (e.g., li, la) may be implemented using more than one actual instruction. See the assembled code in the Execute tab of RARS

main:
	li s0, MMIO_BASE		# MMIO_BASE
	li s6, LSB_MASK			# A mask for extracting out the LSB to check for '\0'
	addi s5, s0, SEVENSEG_OFF		# SEVENSEG.
	addi s7, s0, LED_OFF		# LEDs
	addi s8, s0, UART_TX_READY_OFF	# UART ready for output flag
	addi s9, s0, UART_RX_VALID_OFF	# UART new data flag
	addi s10, s0, UART_RX_OFF		# UART RX
	addi s11, s0, UART_TX_OFF		# UART TX

WAIT_A:
	lw t1, (s9)		# read the new character flag
	beq t1, zero, WAIT_A	# go back and wait if there is no new character. Could have been written as pseudoinstruction beqz t1, WAIT_A
	lw t0, (s10)		# read UART (first character. 'A' - 0x41 expected)
ECHO_A:
	lw t1, (s8)		# check if the UART is ready to be written
	beqz t1, ECHO_A
	sw t0, (s11)		# echo received character to the console
	sw t0, (s5)		# show received character (ASCII) on the 7-Seg display
	sw t0, (s7)		# show received character (ASCII) on the LEDs
	li t2, 'A'
	bne t0, t2, WAIT_A	# not 'A'. Continue waiting
WAIT_CRorLF:			# 'A' received. Need to wait for '\r' (Carriage Return - CR).
	lw t1, (s9)		# read the new character flag
	beqz t1, WAIT_CRorLF	# go back and wait if there is no new character
	lw t0, (s10) 		# read UART (second character. '\r' expected)
ECHO_CRorLF:
	lw t1, (s8)		# check if the UART is ready to be written
	beqz t1, ECHO_CRorLF
	sw t0, (s11)		# echo received character to the console
	sw t0, (s5)		# show received character (ASCII) on the 7-Seg display
	sw t0, (s7)		# show received character (ASCII) on the LEDs
	beq t0, t2, WAIT_CRorLF	# perhaps the user is trying again before completing the pervious attempt, or 'A' was repeated. Just a '\r' needed as we already got an 'A'
	li t1, '\r'
	beq t0, t1, ACCEPT_CRorLF # if t0 == '\r', go to ACCEPT_CRorLF
	li t1, '\n'
	bne t0, t1, WAIT_A	# if t0 != '\r' or '\n', not the correct pattern. try all over again.
ACCEPT_CRorLF:	# "A\r" or "A\n" received.
	la a0, string1		# a0 stores the value to be displayed. This is the argument passed to PRINT_S
PRINT_S:			# Call PRINT_S subroutine (not implemented as a subroutine for now as jal doesn't have link and jalr is not implemented)		
	lw t0, (a0)		# load the word (4 characters) to be displayed
	# sw t0, (s5)		# write to seven segment display
	li t2, 4		# byte counter
NEXTCHAR:
	lw t1, (s8)		# check if CONSOLE is ready to send a new character
	beqz t1, NEXTCHAR	# not ready, continue waiting
	and t1, t0, s6 		# apply LSB_MASK
	beqz t1, WAIT_A 	# null terminator ('\0') detected, done. Return to top
	sw t1, (s11) 		# write to UART the Byte(4-t2) of the original word (composed of 4 characters) in (7:0) of the word to be written (remember, we can only write words, and LEDs/UART displays only (7:0) of the written word)
	srli t0, t0, 8	 	# shift so that the next character comes into LSB
	li t1, 1		# note : no subi instruction in RV
	sub t2, t2, t1		# decrement the loop counter
	bnez t2, NEXTCHAR	# check and print the next character in the word
	addi a0, a0, 4		# point to next word (4 characters)
	j PRINT_S		# start printing the next word
halt:	
	j halt			# infinite loop to halt computation. 

# ------- <code memory (Instruction Memory ROM) ends>			
				
								
#------- <Data Memory begins>									
.data  ## DMEM segment: DMEM_BASE to DMEM_BASE+2^DMEM_DEPTH_BITS-1
# Total number of constants+variables should not exceed 2^DMEM_DEPTH_BITS/4 (128 if DMEM_DEPTH_BITS=9).

DMEM:

string1:
.asciz "\r\nWelcome to CG3207..\r\n"

.align 9	# To set the address at this point to be 512-byte aligned, i.e., DMEM+0x200
STACK_INIT:	# Stack pointer can be initialised to this location - DMEM+0x200 (i.e., the address of stack_top)
#------- <Data Memory ends>													


########################### Ignore the code below #######################################
	#auipc ra,0	# If using a subroutine, store the return value manually since we do not have link
	#addi ra, 12	# just before a jump to store PC+4 in ra
	# not using the subroutine for now, as the only way to return is jalr which isn't implemented for Lab 2

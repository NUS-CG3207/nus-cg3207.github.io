# RARS Syscalls Demonstration (print_int, print_string, print_hex, print_char, exit)
# ⚠ ecall is a simulator convenience — real hardware needs trap support in the processor AND an OS/ISR to service it, and the CG3207 Wrapper has neither. Use the MMIO peripherals for real I/O.

# Memory this program needs: IROM_DEPTH_BITS 9, DMEM_DEPTH_BITS 9
# (2**9 = 512 bytes of code, 2**9 = 512 bytes of data). The simulator sets its
# Linker segments from these when you pick the example; set the same two
# localparams in Wrapper.v. Change both if you change the program.

.text
main:
	# 1. Print null-terminated string (Syscall 4)
	la	a0, msg_hello
	li	a7, 4
	ecall

	# 2. Print integer in decimal (Syscall 1)
	li	a0, 2026
	li	a7, 1
	ecall

	# Print newline (Syscall 11)
	li	a0, 10
	li	a7, 11
	ecall

	# 3. Print integer in hexadecimal (Syscall 34)
	li	a0, 0xCAFEBABE
	li	a7, 34
	ecall

	# Print newline (Syscall 11)
	li	a0, 10
	li	a7, 11
	ecall

	# 4. Print single character (Syscall 11)
	li	a0, 82	# 'R'
	li	a7, 11
	ecall
	li	a0, 86	# 'V'
	li	a7, 11
	ecall

	# Print newline (Syscall 11)
	li	a0, 10
	li	a7, 11
	ecall

	# 5. Program exit (Syscall 10)
	li	a7, 10
	ecall

.data
msg_hello: .asciz "RARS ecall demo: Year = "

# Fibonacci — compute fib(10) = 55
# ⚠ ecall is a simulator convenience — real hardware needs trap support in the processor AND an OS/ISR to service it, and the CG3207 Wrapper has neither. Use the MMIO peripherals for real I/O.

# Memory this program needs: IROM_DEPTH_BITS 9, DMEM_DEPTH_BITS 9
# (2**9 = 512 bytes of code, 2**9 = 512 bytes of data). The simulator sets its
# Linker segments from these when you pick the example; set the same two
# localparams in Wrapper.v. Change both if you change the program.

.text
main:
	li	x1, 0	# fib(0)
	li	x2, 1	# fib(1)
	li	x3, 10	# n = 10
	li	x4, 2	# counter
loop:
	bgt	x4, x3, done
	add	x5, x1, x2	# next fib
	mv	x1, x2
	mv	x2, x5
	addi	x4, x4, 1
	j	loop
done:
	la	x28, result
	sw	x2, 0(x28)
	li	a7, 1
	mv	a0, x2
	ecall
	li	a7, 10
	ecall
.data
result: .word 0

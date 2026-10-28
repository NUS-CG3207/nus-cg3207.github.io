.text
main:
    addi t0, zero, 4	// could be li
loop:
    lw   t1, 0(a0)
    add  t2, t1, t3
    sw   t2, 0(a0)
    addi a0, a0, 4
    addi t0, t0, -1
    bne  t0, zero, loop

halt:	
	j halt							

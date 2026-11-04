.text
main:
    addi x1, x0, 0
    addi x2, x0, 4

LOOP:
    addi x1, x1, 1
    blt  x1, x2, LOOP
    addi x3, x0, 10

halt:	
	j halt		
								
#------- <Data Memory begins>									
.data  ## DMEM segment: DMEM_BASE to DMEM_BASE+2^DMEM_DEPTH_BITS-1
# Total number of constants+variables should not exceed 2^DMEM_DEPTH_BITS/4 (128 if DMEM_DEPTH_BITS=9).

DMEM:


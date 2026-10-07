# Output of Circle_delay_accel.c when compiled using RISC-V rv32gc clang 20.1.0 (C language, not C++) with -Os directive (via godbolt.org)

# Make sure all instructions used below (many are pseudoinstructions, assemble and check for real instructions) are implemented in your HDL.

# Assemble this using RARS. Dump memory => .txt as AA_IROM.mem and .data as AA_DMEM.mem, in hexadecimal text format.

# Memory this program needs: IROM_DEPTH_BITS 10, DMEM_DEPTH_BITS 9
# (2**10 = 1024 bytes of code, 2**9 = 512 bytes of data). The simulator sets its
# Linker segments from these when you pick the example; set the same two
# localparams in Wrapper.v. Change both if you change the program.

main:
        addi    sp, sp, -32
        sw      ra, 28(sp)
        sw      s0, 24(sp)
        sw      s1, 20(sp)
        sw      s2, 16(sp)
        sw      s3, 12(sp)
        li      a0, 0
        lui     s2, 1048560
        lui     sp, 65552
        addi    sp, sp, 512
        li      a3, 84
        lui     a1, %hi(.L.str)
        addi    a1, a1, %lo(.L.str)
        li      a2, 53
.LBB0_1:
        lw      a4, 8(s2)
        beqz    a4, .LBB0_1
        sw      a3, 12(s2)
        addi    a0, a0, 1
        add     a3, a1, a0
        lbu     a3, 0(a3)
        bne     a0, a2, .LBB0_1
        lui     s1, 1044480
        li      s0, 32
        lui     s3, %hi(CYCLECOUNT_ADDR)
.LBB0_4:
        li      a0, 0
        li      a3, 0
        lw      a1, 64(s2)
        sw      a1, 128(s2)
.LBB0_5:
        sll     a4, a1, a0
        and     a2, a4, s1
        bgez    a4, .LBB0_7
        neg     a2, a2
.LBB0_7:
        srl     a2, a2, a0
        addi    a0, a0, 8
        add     a3, a3, a2
        bne     a0, s0, .LBB0_5
        slli    a3, a3, 1
        li      a0, 48
        li      a1, 32
        li      a2, 28
        call    drawFilledMidpointCircleSinglePixelVisit
        lw      a0, %lo(CYCLECOUNT_ADDR)(s3)
        lw      a1, 0(a0)
        addi    a1, a1, 50
.LBB0_9:
        lw      a2, 0(a0)
        bltu    a2, a1, .LBB0_9
        j       .LBB0_4

drawFilledMidpointCircleSinglePixelVisit:
        bltz    a2, .LBB1_19
        li      t1, 0
        lui     t3, 1048560
        li      a6, 1
        sub     t0, a6, a2
        li      a7, 33
.LBB1_2:
        mv      t2, t1
        add     a4, t1, a1
        sw      a4, 36(t3)
        sw      a7, 44(t3)
        sw      a3, 40(t3)
        bltz    a2, .LBB1_8
        sub     t1, a0, a2
        slli    t4, a2, 1
        addi    t4, t4, 1
        mv      a4, t4
        mv      a5, t1
.LBB1_4:
        sw      a5, 32(t3)
        addi    a4, a4, -1
        addi    a5, a5, 1
        bnez    a4, .LBB1_4
        beqz    t2, .LBB1_10
        sub     a4, a1, t2
        sw      a4, 36(t3)
        sw      a7, 44(t3)
        sw      a3, 40(t3)
.LBB1_7:
        sw      t1, 32(t3)
        addi    t4, t4, -1
        addi    t1, t1, 1
        bnez    t4, .LBB1_7
        j       .LBB1_10
.LBB1_8:
        beqz    t2, .LBB1_10
        sub     a4, a1, t2
        sw      a4, 36(t3)
        sw      a7, 44(t3)
        sw      a3, 40(t3)
.LBB1_10:
        addi    t1, t2, 1
        bltz    t0, .LBB1_17
        bge     t2, a2, .LBB1_16
        sub     t4, a0, t2
        add     a4, a2, a1
        sw      a4, 36(t3)
        sw      a7, 44(t3)
        sw      a3, 40(t3)
        mv      a4, a6
        mv      a5, t4
.LBB1_13:
        sw      a5, 32(t3)
        addi    a4, a4, -1
        addi    a5, a5, 1
        bnez    a4, .LBB1_13
        sub     a4, a1, a2
        sw      a4, 36(t3)
        sw      a7, 44(t3)
        sw      a3, 40(t3)
        mv      a4, a6
.LBB1_15:
        sw      t4, 32(t3)
        addi    a4, a4, -1
        addi    t4, t4, 1
        bnez    a4, .LBB1_15
.LBB1_16:
        addi    a2, a2, -1
        sub     a4, t1, a2
        slli    a4, a4, 1
        addi    a4, a4, 2
        j       .LBB1_18
.LBB1_17:
        slli    a4, t1, 1
        addi    a4, a4, 1
.LBB1_18:
        add     t0, t0, a4
        addi    a6, a6, 2
        blt     t2, a2, .LBB1_2
.LBB1_19:
        ret

delay:
        lui     a1, %hi(CYCLECOUNT_ADDR)
        lw      a1, %lo(CYCLECOUNT_ADDR)(a1)
        lw      a2, 0(a1)
        add     a0, a0, a2
.LBB2_1:
        lw      a2, 0(a1)
        bltu    a2, a0, .LBB2_1
        ret

drawHorizontalLine:
        lui     a4, 1048560
        sw      a2, 36(a4)
        li      a2, 33
        sw      a2, 44(a4)
        sw      a3, 40(a4)
        blt     a1, a0, .LBB3_3
        addi    a1, a1, 1
.LBB3_2:
        sw      a0, 32(a4)
        addi    a0, a0, 1
        bne     a1, a0, .LBB3_2
.LBB3_3:
        ret

.data	# The only line that needs to be added manually

CYCLECOUNT_ADDR:
        .word   4294901920

.L.str:
        .asciz  "Tilt in various directions to see the colour change\r\n"


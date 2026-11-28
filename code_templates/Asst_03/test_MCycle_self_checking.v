`timescale 1ns / 1ps
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

test_MCycle.v drives the unit and leaves you to read the waveform. This one runs
the same unit against a scoreboard, at the width RV.v actually instantiates, and
covers the cases the four stimuli in that file do not: division, the RISC-V
division-by-zero and most-negative-divided-by-minus-one results, and the widths
at which a partial product or a running remainder would overflow.

Start is pulsed rather than held, so each operation is driven from a known idle
state. Holding it, as test_MCycle.v does, is also legal and is what RV.v does.
*/

module test_MCycle_self_checking #(
        parameter width = 32
    )(
    );

    reg CLK = 0 ;
    reg RESET = 0 ;
    reg Start = 0 ;
    reg [2:0] MCycleOp = 0 ;
    reg [width-1:0] Operand1 = 0 ;
    reg [width-1:0] Operand2 = 0 ;

    wire [width-1:0] Result1 ;
    wire [width-1:0] Result2 ;
    wire Busy ;

    integer pass_count = 0 ;
    integer fail_count = 0 ;

    MCycle #(.width(width)) dut(
        .CLK(CLK),
        .RESET(RESET),
        .Start(Start),
        .MCycleOp(MCycleOp),
        .Operand1(Operand1),
        .Operand2(Operand2),
        .Result1(Result1),
        .Result2(Result2),
        .Busy(Busy)
    ) ;

    always #5 CLK = ~CLK ;

    // Run one operation to completion and compare both result words.
    task run_op ;
        input [8*24-1:0] name ;
        input [2:0] op ;
        input [width-1:0] a ;
        input [width-1:0] b ;
        input [width-1:0] exp1 ;
        input [width-1:0] exp2 ;
        begin
            @(negedge CLK) ;
            MCycleOp = op ; Operand1 = a ; Operand2 = b ; Start = 1'b1 ;
            @(negedge CLK) ;
            Start = 1'b0 ;
            wait(~Busy) ;
            @(negedge CLK) ;
            if (Result1 === exp1 && Result2 === exp2) begin
                pass_count = pass_count + 1 ;
            end
            else begin
                fail_count = fail_count + 1 ;
                $display("FAIL %0s: op=%b a=%h b=%h -> Result1=%h Result2=%h, expected %h / %h",
                         name, op, a, b, Result1, Result2, exp1, exp2) ;
            end
        end
    endtask

    // Reference results, computed the way the RISC-V M extension defines them.
    reg signed [2*width-1:0] prod_s ;
    reg [2*width-1:0] prod_u ;
    reg signed [width-1:0] sa, sb ;

    task chk_mul_s ; input [width-1:0] a ; input [width-1:0] b ; begin
        sa = a ; sb = b ; prod_s = sa * sb ;
        run_op("mul signed", 3'b000, a, b, prod_s[width-1:0], prod_s[2*width-1:width]) ;
    end endtask

    task chk_mul_u ; input [width-1:0] a ; input [width-1:0] b ; begin
        prod_u = a * b ;
        run_op("mul unsigned", 3'b011, a, b, prod_u[width-1:0], prod_u[2*width-1:width]) ;
    end endtask

    // mulhsu: a signed multiplicand, an unsigned multiplier. The reference is
    // built by sign extending only the first operand, which is what the mode does.
    task chk_mul_su ; input [width-1:0] a ; input [width-1:0] b ;
        reg [2*width-1:0] p ; begin
        sa = a ;
        p = {{width{sa[width-1]}}, a} * {{width{1'b0}}, b} ;
        run_op("mul signed x unsigned", 3'b001, a, b, p[width-1:0], p[2*width-1:width]) ;
    end endtask

    task chk_div_s ; input [width-1:0] a ; input [width-1:0] b ;
        reg [width-1:0] q, r ; begin
        sa = a ; sb = b ;
        if (b == 0) begin q = {width{1'b1}} ; r = a ; end
        else if (a == {1'b1, {width-1{1'b0}}} && &b) begin q = a ; r = 0 ; end
        else begin q = sa / sb ; r = sa % sb ; end
        run_op("div signed", 3'b100, a, b, q, r) ;
    end endtask

    task chk_div_u ; input [width-1:0] a ; input [width-1:0] b ;
        reg [width-1:0] q, r ; begin
        if (b == 0) begin q = {width{1'b1}} ; r = a ; end
        else begin q = a / b ; r = a % b ; end
        run_op("div unsigned", 3'b111, a, b, q, r) ;
    end endtask

    integer i ;
    reg [width-1:0] ra, rb ;

    initial begin
        $display("=== MCycle self-check, width = %0d ===", width) ;
        RESET = 1 ; @(negedge CLK) ; @(negedge CLK) ; RESET = 0 ;

        // --- multiplication ---
        chk_mul_s({width{1'b1}}, {width{1'b1}}) ;                 // -1 * -1
        chk_mul_s({width{1'b1}}, {{width-1{1'b0}}, 1'b1}) ;       // -1 * 1
        chk_mul_s(0, {width{1'b1}}) ;                             // 0 * -1
        chk_mul_s({1'b1, {width-1{1'b0}}}, {width{1'b1}}) ;       // most negative * -1
        chk_mul_s({1'b0, {width-1{1'b1}}}, {1'b0, {width-1{1'b1}}}) ; // max * max
        chk_mul_s({1'b1, {width-1{1'b0}}}, {1'b1, {width-1{1'b0}}}) ; // min * min

        chk_mul_u({width{1'b1}}, {width{1'b1}}) ;                 // all ones squared
        chk_mul_u({width{1'b1}}, 0) ;
        chk_mul_u({1'b1, {width-1{1'b0}}}, 2) ;                   // carry into the top word

        chk_mul_su({width{1'b1}}, {width{1'b1}}) ;                // -1 x the largest unsigned
        chk_mul_su({1'b1, {width-1{1'b0}}}, {width{1'b1}}) ;      // most negative x the largest unsigned
        chk_mul_su({1'b0, {width-1{1'b1}}}, {width{1'b1}}) ;      // where it differs from mulhu
        chk_mul_su(0, {width{1'b1}}) ;
        chk_mul_su({width{1'b1}}, 0) ;

        // --- division ---
        chk_div_s(100, 7) ;
        chk_div_s(-100, 7) ;
        chk_div_s(100, -7) ;
        chk_div_s(-100, -7) ;
        chk_div_s(7, 100) ;                                       // quotient 0
        chk_div_s(0, 5) ;
        chk_div_s(5, 0) ;                                         // by zero: -1 rem 5
        chk_div_s(-5, 0) ;                                        // by zero: -1 rem -5
        chk_div_s({1'b1, {width-1{1'b0}}}, {width{1'b1}}) ;       // min / -1: overflow case
        chk_div_s({1'b1, {width-1{1'b0}}}, 1) ;
        chk_div_s({width{1'b1}}, {width{1'b1}}) ;                 // -1 / -1

        chk_div_u(100, 7) ;
        chk_div_u({width{1'b1}}, {width{1'b1}}) ;
        chk_div_u({width{1'b1}}, 1) ;
        chk_div_u({width{1'b1}}, 2) ;                             // divisor > 2^(width-1): the compare that needs the extra bit
        chk_div_u({1'b1, {width-1{1'b0}}}, {1'b0, {width-1{1'b1}}}) ;
        chk_div_u(0, 0) ;
        chk_div_u(1234, 0) ;
        chk_div_u(3, 4) ;

        // --- random ---
        for (i = 0; i < 40; i = i + 1) begin
            ra = {$random, $random} ; rb = {$random, $random} ;
            chk_mul_s(ra, rb) ;
            chk_mul_u(ra, rb) ;
            chk_mul_su(ra, rb) ;
            chk_div_s(ra, rb) ;
            chk_div_u(ra, rb) ;
        end

        $display("=== %0d passed, %0d failed ===", pass_count, fail_count) ;
        if (fail_count == 0) $display("*** ALL MCYCLE TESTS PASSED ***") ;
        $finish ;
    end

endmodule

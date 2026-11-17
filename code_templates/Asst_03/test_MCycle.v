`timescale 1ns / 1ps
/*
----------------------------------------------------------------------------------
-- Description: Testbench for MCycle.
----------------------------------------------------------------------------------

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
*/

module test_MCycle(

    );
    
    // DECLARE INPUT SIGNALs
    reg CLK = 0 ;
    reg RESET = 0 ;
    reg Start = 0 ;
    reg [1:0] MCycleOp = 0 ;
    reg [3:0] Operand1 = 0 ;
    reg [3:0] Operand2 = 0 ;

    // DECLARE OUTPUT SIGNALs
    wire [3:0] Result1 ;
    wire [3:0] Result2 ;
    wire Busy ;
    
    // INSTANTIATE DEVICE/UNIT UNDER TEST (DUT/UUT)
    MCycle dut( 
        CLK, 
        RESET, 
        Start, 
        MCycleOp, 
        Operand1, 
        Operand2, 
        Result1, 
        Result2, 
        Busy
        ) ;
    
    // STIMULI
    initial begin
        // hold reset state for 100 ns.
        #10 ;    
        MCycleOp = 2'b00 ;
        Operand1 = 4'b1111 ;
        Operand2 = 4'b1111 ;
        Start = 1'b1 ; // Start is asserted continously(Operations are performed back to back). To try a non-continous Start, you can uncomment the commented lines.    

        wait(Busy) ; // suspend initial block till condition becomes true  ;
        wait(~Busy) ;
//        #10 ;
//        Start = 1'b0 ;
//        #10 ;
        Operand1 = 4'b1110 ;
        Operand2 = 4'b1111 ;
//        Start = 1'b1 ;
        
        wait(Busy) ; 
        wait(~Busy) ;
//        #10 ;
//        Start = 1'b0 ;
//        #10 ;
        MCycleOp = 2'b01 ;
        Operand1 = 4'b1111 ;
        Operand2 = 4'b1111 ;
//        Start = 1'b1 ;

        wait(Busy) ; 
        wait(~Busy) ; 
//        #10 ;
//        Start = 1'b0 ;
//        #10 ;
        Operand1 = 4'b1110 ;
        Operand2 = 4'b1111 ;
//        Start = 1'b1 ;

        wait(Busy) ; 
        wait(~Busy) ; 
        Start = 1'b0 ;
    end
     
    // GENERATE CLOCK       
    always begin 
        #5 CLK = ~CLK ; 
        // invert CLK every 5 time units 
    end
    
endmodule
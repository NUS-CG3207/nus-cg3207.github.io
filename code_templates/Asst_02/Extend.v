`timescale 1ns / 1ps
/*
----------------------------------------------------------------------------------
-- Description: RISC-V Processor Immediate Extend Module.
--              Interface and implementation can be modified.
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

module Extend(
    input [2:0] ImmSrc, 
    input [31:7] InstrImm, //maintaining the numbering in the instruction for comprehensibility
    output reg [31:0] ExtImm
    );
    
    // ImmSrc pattern chosen (not optimally) such that single bit changes for more similar immediates, which can simplify the logic.
    // For example, SB and S are very similar, so they are assigned 110 and 111 respectively.
    
    always@(ImmSrc, InstrImm)
        case(ImmSrc)
            3'b000: ExtImm = {InstrImm[31:12], 12'h000} ;  // U type
            3'b010: ExtImm = {{12{InstrImm[31]}}, InstrImm[19:12], InstrImm[20], InstrImm[30:21], 1'b0} ;   // UJ   
            3'b011: ExtImm = {{20{InstrImm[31]}}, InstrImm[31:20]} ;  // I    
            3'b110: ExtImm = {{20{InstrImm[31]}}, InstrImm[31:25], InstrImm[11:7]} ;  // S    
            3'b111: ExtImm = {{20{InstrImm[31]}}, InstrImm[7], InstrImm[30:25], InstrImm[11:8], 1'b0} ;  // SB    
            default: ExtImm = 32'bx ;  // undefined     
        endcase   
    
endmodule

/*
case(ImmSrc)
    3'b000: ExtImm <= {    InstrImm[31:20],InstrImm[19:12], 12'h000} ;  // U type
    3'b010: ExtImm <= {{12{InstrImm[31]}}, InstrImm[19:12], InstrImm[20], InstrImm[30:25], InstrImm[24:21], 1'b0} ;   		// UJ   
    3'b011: ExtImm <= {{20{InstrImm[31]}}, InstrImm[31],                  InstrImm[30:25], InstrImm[24:21], InstrImm[20]} ; // I    
    3'b110: ExtImm <= {{20{InstrImm[31]}}, InstrImm[31],                  InstrImm[30:25], InstrImm[11:8], InstrImm[7]} ;  	// S    
    3'b111: ExtImm <= {{20{InstrImm[31]}}, InstrImm[7],                   InstrImm[30:25], InstrImm[11:8], 1'b0} ;  		// SB    
    default: ExtImm <= 32'bx ;  // undefined     
endcase   
*/

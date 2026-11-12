`timescale 1ns / 1ps
/*
----------------------------------------------------------------------------------
-- Description: RISC-V Processor Register File Module.
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

module RegFile(
    input CLK,
    input WE,
    input [4:0] rs1,
    input [4:0] rs2,
    input [4:0] rd,
    input [31:0] WD,
    output reg [31:0] RD1,
    output reg [31:0] RD2
    );
    
    // declare RegBank
    reg [31:0] RegBank[0:31] ;
        // 32 addresses, each a 32-bit word
        // (1 to 31) is sufficient as R15 is not stored. Kept it as (0 to 31) just to supress a warning
		
    // read
    always@(*)	// change to @posedge CLK only if using synch read. In that case, the output is RD1E, RD2E directly
    begin
    	RD1 <= (rs1 == 5'b00000) ? 32'd0 : RegBank[rs1] ; 
    	RD2 <= (rs2 == 5'b00000) ? 32'd0 : RegBank[rs2] ;  
    end 
    
    // write
    always@(posedge CLK)
    begin
        if((rd != 5'b00000) & (WE))
            RegBank[rd] <= WD ;
    end
    
endmodule














`timescale 1ns / 1ps
/*
----------------------------------------------------------------------------------
-- Description: RISC-V Processor ALU Module.
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

module ALU(
	input [31:0] Src_A,
	input [31:0] Src_B,
	input [3:0] ALUControl, // 0000 for add, 0001 for sub, 1110 for and, 1100 for or, 0010 for sll, 1010 for srl, 1011 for sra.
	output reg [31:0] ALUResult,
	output [2:0] ALUFlags //{eq, lt, ltu}
);
    
	// Shifter signals
	wire [1:0] Sh ;
	wire [4:0] Shamt5 ;
	wire [31:0] ShIn ;
	wire [31:0] ShOut ;
	
	// Other signals
	wire [32:0] S_wider ;
	reg [32:0] Src_A_comp ;
	reg [32:0] Src_B_comp ;
	reg [32:0] C_0 ;
	wire N, Z, C, V; 	// optional intermediate values to derive eq, lt, ltu
				// Hint: We need to care about V only for subtraction
	
	assign S_wider = Src_A_comp + Src_B_comp + C_0 ;
    
	always@(Src_A, Src_B, ALUControl, S_wider, ShOut) begin
        // default values; help avoid latches
		C_0 = 0 ; 
		Src_A_comp = {1'b0, Src_A} ;
		Src_B_comp = {1'b0, Src_B} ;
    
		case(ALUControl)
			4'b0000: ALUResult = S_wider[31:0] ;	//add          
	            	4'b0001: begin				//sub
				C_0[0] = 1 ;  
				Src_B_comp = {1'b0, ~ Src_B} ;
				ALUResult = S_wider[31:0] ;
			end
	            	4'b1110: ALUResult = Src_A & Src_B ;	// and
	            	4'b1100: ALUResult = Src_A | Src_B ; 	// or
	            
			// include cases for shifts		// shifts
			default: ALUResult = 32'bx;
	        endcase
	    end
      
	assign Z = (ALUResult == 0) ? 1 : 0 ;
    
	assign ALUFlags = {Z, 1'b0, 1'b0} ; 	//{eq, lt, ltu} - all except eq are placeholders. 
    						// todo: Will need to be modified in to support blt, bltu, bge, bgeu.
    
    
	// todo: make shifter connections here
	// Sh signals can be derived directly from the appropriate ALUControl bits
    
    
	// Instantiate Shifter        
	Shifter Shifter1(
            Sh,
        	Shamt5,
        	ShIn,
        	ShOut
        );
     
endmodule

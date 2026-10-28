`timescale 1ns / 1ps
/*
----------------------------------------------------------------------------------
-- Company: NUS
-- Engineer: (c) Shahzor Ahmad and Rajesh Panicker
--
-- Create Date: 09/22/2020 06:49:10 PM
-- Module Name: Shifter
-- Project Name: CG3207 Project
-- Target Devices: Nexys 4 / Basys 3
-- Tool Versions: Vivado 2019.2
-- Description: RISC-V Processor Shifter Module
--
-- Dependencies: NIL
--
-- Revision:
-- Revision 0.01 - File Created
-- Additional Comments: Interface and implementation can be modified.
--
----------------------------------------------------------------------------------

----------------------------------------------------------------------------------
--	License terms :
--	You are free to use this code as long as you
--		(i) DO NOT post it on any public repository;
--		(ii) use it only for educational purposes;
--		(iii) accept the responsibility to ensure that your implementation does not violate anyone's intellectual property.
--		(iv) accept that the program is provided "as is" without warranty of any kind or assurance regarding its suitability for any particular purpose;
--		(v) send an email to rajesh<dot>panicker<at>ieee.org briefly mentioning its use (except when used for the course CG3207 at the National University of Singapore);
--		(vi) retain this notice in this file as well as any files derived from this.
----------------------------------------------------------------------------------
*/

module Shifter(
    input [1:0] Sh,
    input [4:0] Shamt5,
    input [31:0] ShIn,
    output reg [31:0] ShOut
    );

    // Sh is {ALUControl[3], ALUControl[0]}: 00 sll, 10 srl, 11 sra.
    // 01 would be a rotate, which RISC-V does not have.
    always@(*) begin
        case(Sh)
            2'b00: ShOut = ShIn << Shamt5 ;                 // sll
            2'b10: ShOut = ShIn >> Shamt5 ;                 // srl
            2'b11: ShOut = $signed(ShIn) >>> Shamt5 ;       // sra
            default: ShOut = ShIn ;
        endcase
    end

endmodule

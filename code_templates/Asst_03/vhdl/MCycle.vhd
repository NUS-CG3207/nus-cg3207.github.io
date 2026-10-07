----------------------------------------------------------------------------------
-- Company: NUS	
-- Engineer: Rajesh Panicker
-- 
-- Create Date: 10/13/2015 06:49:10 PM
-- Module Name: ALU
-- Project Name: CG3207 Project
-- Target Devices: Nexys 4 (Artix 7 100T)
-- Tool Versions: Vivado 2015.2
-- Description: Multicycle Operations Module
-- 
-- Dependencies: NIL
-- 
-- Revision:
-- Revision 0.01 - File Created
-- Additional Comments:
-- 
----------------------------------------------------------------------------------

----------------------------------------------------------------------------------
--	(c) Rajesh Panicker
--	License terms :
--	You are free to use this code as long as you
--		(i) DO NOT post it on any public repository;
--		(ii) use it only for educational purposes;
--		(iii) accept the responsibility to ensure that your implementation does not violate any intellectual property of ARM Holdings or other entities.
--		(iv) accept that the program is provided "as is" without warranty of any kind or assurance regarding its suitability for any particular purpose;
--		(v) send an email to rajesh.panicker@ieee.org briefly mentioning its use (except when used for the course CG3207 at the National University of Singapore);
--		(vi) retain this notice in this file or any files derived from this.
----------------------------------------------------------------------------------

-- Assume that Operand1, Operand 2, MCycleOp will not change after Start is asserted until the next clock edge after Busy goes to '0'.
-- Start to be asserted by the control unit should assert this when an instruction with a multi-cycle operation is detected. 
-- Start should be deasserted within 1 clock cycle after Busy goes low. Else, the MCycle unit will treat it as another operation.

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.STD_LOGIC_UNSIGNED.ALL;

entity MCycle is
generic (width 	: integer := 4); -- Keep this at 4 to verify your algorithms with 4 bit numbers (easier). When using MCycle as a component in ARM, generic map it to 32.
Port (CLK		: in	STD_LOGIC;
		RESET		: in 	STD_LOGIC;  -- Connect this to the reset of the ARM processor.
		Start		: in 	STD_LOGIC;  -- Multi-cycle Enable. The control unit should assert this when an instruction with a multi-cycle operation is detected.
		MCycleOp	: in	STD_LOGIC_VECTOR (1 downto 0); -- Multi-cycle Operation. "00" for signed multiplication, "01" for unsigned multiplication, "10" for signed division, "11" for unsigned division.
		Operand1	: in	STD_LOGIC_VECTOR (width-1 downto 0); -- Multiplicand / Dividend
		Operand2	: in	STD_LOGIC_VECTOR (width-1 downto 0); -- Multiplier / Divisor
		Result1	: out	STD_LOGIC_VECTOR (width-1 downto 0); -- LSW of Product / Quotient
		Result2	: out	STD_LOGIC_VECTOR (width-1 downto 0); -- MSW of Product / Remainder
		Busy		: out	STD_LOGIC);  -- Set immediately when Start is set. Cleared when the Results become ready. This bit can be used to stall the processor while multi-cycle operations are on.
end MCycle;


architecture Arch_MCycle of MCycle is

type states is (IDLE, COMPUTING);
signal state, n_state 	: states := IDLE;
signal done 	: std_logic;

begin

IDLE_PROCESS : process (state, done, Start, RESET)
begin

-- <default outputs>
Busy <= '0';
n_state <= IDLE;

--reset
if RESET = '1' then
	n_state <= IDLE;
	--Busy <= '0';	--implicit
else
	case state is
		when IDLE =>
			if Start = '1' then
				n_state <= COMPUTING;
				Busy <= '1';
			end if;
		when COMPUTING => 
			if done = '1' then
				n_state <= IDLE;
				--Busy <= '0'; --implicit
			else
				n_state <= COMPUTING;
				Busy <= '1';
			end if;
	end case;
end if;	
end process;

COMPUTING_PROCESS : process (CLK) -- process which does the actual computation
variable count : std_logic_vector(7 downto 0) := (others => '0'); -- assuming no computation takes more than 256 cycles.
variable temp_sum : std_logic_vector(2*width-1 downto 0) := (others => '0');
variable shifted_op1 : std_logic_vector(2*width-1 downto 0) := (others => '0');
variable shifted_op2 : std_logic_vector(2*width-1 downto 0) := (others => '0');
begin  
   if (CLK'event and CLK = '1') then 
   			-- n_state = COMPUTING and state = IDLE implies we are just transitioning into COMPUTING
		if RESET = '1' or (n_state = COMPUTING and state = IDLE) then
			count := (others => '0');
			temp_sum := (others => '0');
			shifted_op1 := (2*width-1 downto width => not(MCycleOp(0)) and Operand1(width-1)) & Operand1;					
			shifted_op2 := (2*width-1 downto width => not(MCycleOp(0)) and Operand2(width-1)) & Operand2;	
		end if;
		done <= '0';			

		if MCycleOp(1)='0' then -- Multiply
		-- MCycleOp(0) = '0' takes 2*'width' cycles to execute, returns signed(Operand1)*signed(Operand2)
		-- MCycleOp(0) = '1' takes 'width' cycles to execute, returns unsigned(Operand1)*unsigned(Operand2)		
			if shifted_op2(0)= '1' then -- add only if b0 = 1
				temp_sum := temp_sum + shifted_op1;
			end if;
			shifted_op2 := '0'& shifted_op2(2*width-1 downto 1);
			shifted_op1 := shifted_op1(2*width-2 downto 0)&'0';	
			
			if (MCycleOp(0)='1' and count=width-1) or (MCycleOp(0)='0' and count=2*width-1) then	 -- last cycle?
				done <= '1';	
			end if;				
			count := count+1;	
		else -- Supposed to be Divide. The dummy code below takes 1 cycle to execute, just returns the operands. Change this to signed [MCycleOp(0) = '0'] and unsigned [MCycleOp(0) = '1'] division.
			temp_sum(2*width-1 downto width) := Operand1;
			temp_sum(width-1 downto 0) := Operand2;
			done <= '1';
		end if;
		Result2 <= temp_sum(2*width-1 downto width);
		Result1 <= temp_sum(width-1 downto 0);
	end if;
end process;

STATE_UPDATE_PROCESS : process (CLK) -- state updating
begin  
   if (CLK'event and CLK = '1') then
		state <= n_state;
   end if;
end process;

end Arch_MCycle;
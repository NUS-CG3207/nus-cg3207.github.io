----------------------------------------------------------------------------------
-- Company: NUS	
-- Engineer: Rajesh Panicker
-- 
-- Create Date: 10/13/2015 06:49:10 PM
-- Module Name: ALU
-- Project Name: CG3207 Project
-- Target Devices: Nexys 4 (Artix 7 100T)
-- Tool Versions: Vivado 2015.2
-- Description: Testbench for Multicycle Operations Module
-- 
-- Dependencies: MCycle
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


LIBRARY ieee;
USE ieee.std_logic_1164.ALL;
 
-- Uncomment the following library declaration if using
-- arithmetic functions with Signed or Unsigned vMCyclees
--USE ieee.numeric_std.ALL;
 
ENTITY test_MCycle IS
END test_MCycle;
 
ARCHITECTURE behavior OF test_MCycle IS 
 
    -- Component Declaration for the Unit Under Test (UUT)
 
    COMPONENT MCycle
    PORT(
         CLK : IN  std_logic;
         RESET : IN  std_logic;
         Start : IN  std_logic;
         MCycleOp : IN  std_logic_vector(1 downto 0);
         Operand1 : IN  std_logic_vector(3 downto 0);
         Operand2 : IN  std_logic_vector(3 downto 0);
         Result1 : OUT  std_logic_vector(3 downto 0);
         Result2 : OUT  std_logic_vector(3 downto 0);
         Busy : OUT  std_logic
        );
    END COMPONENT;
    

   --Inputs
   signal CLK : std_logic := '0';
   signal RESET : std_logic := '0';
   signal Start : std_logic := '0';
   signal MCycleOp : std_logic_vector(1 downto 0) := (others => '0');
   signal Operand1 : std_logic_vector(3 downto 0) := (others => '0');
   signal Operand2 : std_logic_vector(3 downto 0) := (others => '0');

 	--Outputs
   signal Result1 : std_logic_vector(3 downto 0);
   signal Result2 : std_logic_vector(3 downto 0);
   signal Busy : std_logic;

   -- Clock period definitions
   constant CLK_period : time := 10 ns;
 
BEGIN
 
	-- Instantiate the Unit Under Test (UUT)
   uut: MCycle PORT MAP (
          CLK => CLK,
          RESET => RESET,
          Start => Start,
          MCycleOp => MCycleOp,
          Operand1 => Operand1,
          Operand2 => Operand2,
          Result1 => Result1,
          Result2 => Result2,
          Busy => Busy
        );

   -- Clock process definitions
   CLK_process :process
   begin
		CLK <= '0';
		wait for CLK_period/2;
		CLK <= '1';
		wait for CLK_period/2;
   end process;
 

   -- Stimulus process
   stim_proc: process
   begin		
      -- hold reset state for 100 ns.
      wait for 10 ns;	
		MCycleOp <= "00";
		Operand1 <= "1111";
		Operand2 <= "1111";
		Start <= '1';		-- Start is asserted continously(Operations are performed back to back). To try a non-continous Start, you can uncomment the commented lines.	
      wait until Busy = '0'; 
		--wait for 10 ns;		
		--Start <= '0';	
		--wait for 10 ns;
		Operand1 <= "1110";
		Operand2 <= "1111";
		--Start <= '1';
      wait until Busy = '0'; 	
		--wait for 10 ns;
		--Start <= '0';	
		--wait for 10 ns;
		MCycleOp <= "01";		
		Operand1 <= "1111";
		Operand2 <= "1111";
		--Start <= '1';
      wait until Busy = '0'; 	
		--wait for 10 ns;
		--Start <= '0';		
		--wait for 10 ns;	
		Operand1 <= "1110";
		Operand2 <= "1111";
		--Start <= '1';
      wait until Busy = '0';
		Start <= '0';
		wait;

   end process;

END;

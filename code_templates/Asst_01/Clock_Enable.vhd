--This module is to generate an enable signal for different display frequency based on pushbuttons
-- Fill in the blank to complete this module 
-- (c) Gu Jing and Rajesh Panicker, ECE, NUS

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;


entity Clock_Enable is
-- fundamental clock 100 MHz
-- button BTNU for 4Hz speed
-- button BTNC for pause
-- output signal used to enable the reading of next memory data
    Port( clk : in std_logic;
          btnU : in std_logic;
          btnC : in std_logic;
          enable : out std_logic);
end Clock_Enable;

architecture Behavioral of Clock_Enable is
begin

process(clk)
-- define reg threshold to allow 4hz or 1hz frequency



-- define reg counter to be able to count to certain threshold value



-- complete this block by determining the enable output by counter, threshold and buttons 
begin
    
	
	
	
	
	
	
	
end process;

end Behavioral;

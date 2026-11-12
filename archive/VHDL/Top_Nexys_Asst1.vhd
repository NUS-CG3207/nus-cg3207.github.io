-- Top level module
-- This project displays the memory contents on both LEDs (16 bits by 16 bits) and 
-- 7-segments (32 bits by 32 bits) with a frequency chosen by BTNU and BTNC.   
-- (c) Gu Jing and Rajesh Panicker, ECE, NUS

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;


entity lab1 is
-- fundamental clock 100 MHz
-- button BTNU for 4Hz speed
-- button BTNC for pause
-- 16 LEDs to display upper or lower 16 bits of memory data
-- dot point of 7-segments, can be deleted if 7-segments are not implemented
-- anodes of 7-segments, can be deleted if 7-segments are not implemented
-- cathodes of 7-segments, can be deleted if 7-segments are not implemented
    Port ( clk, btnU, btnC : in std_logic;
           led : out std_logic_vector(15 downto 0);
           dp: out std_logic;
           anode : out std_logic_vector(7 downto 0);
           cathode : out std_logic_vector(6 downto 0));
end lab1;

-- enable signal to read the next memory content
-- 1-bit signal used between modules to indicate either upper or lower 16-bit contents is displaying on LEDs, upper_lower = 1 to display upper half of the Memory data
-- entire 32-bit contents displaying on LEDs and 7-segments, can be deleted if 7-segments are not implemented
architecture Behavioral of lab1 is
    signal enable : std_logic := '0';
    signal upper_lower : std_logic := '0';
    signal data : std_logic_vector(31 downto 0);
begin

-- Choose 1hz or 4hz display frequency based on BTNU and BTNC readings, using given module Clock_Enable.vhd





-- Fetch memory content, using given module Get_MEM.vhd       





-- Displays the 32-bit memory data on 7-segments, using given module Seven_Seg.v
-- This module can be deleted if students do not want to implement the 7-segment display





-- split the 32-bit Memory data using a multiplexer to display on led


end Behavioral;

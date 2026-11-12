-- This module should contain the corresponding Memory data generated from Hex2ROM
-- and choose the memory data to be displayed based on enable signal  
-- Fill in the blank to complete this module 
-- (c) Gu Jing and Rajesh Panicker, ECE, NUS

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use ieee.numeric_std.all;


entity Get_MEM is
-- fundamental clock 100MHz
-- enable signal to read the next content
-- 32 bits memory contents for 7-segments display
-- 1-bit signal required for LEDs, indicating which half of the Memory data is displaying on LEDs
    Port ( clk : in std_logic;
           enable : in std_logic;
           data : out std_logic_vector(31 downto 0);
	       upper_lower : out std_logic
	);
end Get_MEM;

architecture Behavioral of Get_MEM is
	-- declare address for IROM and DMEM
    signal addr : std_logic_vector(8 downto 0) := (others => '0');
	
	-- declare IROM and DMEM
    type MEM_128x32 is array (0 to 127) of std_logic_vector (31 downto 0); 
    
    ----------------------------------------------------------------
    -- Instruction Memory
    ----------------------------------------------------------------

	
	    signal IROM : MEM_128x32 := (
        -- Load the instruction memory from the memory file "IROM.mem"
        );
	
	
    ----------------------------------------------------------------
    -- Data Memory
    ----------------------------------------------------------------

        signal DMEM : MEM_128x32 := (
            -- Load the data memory from the memory file "DMEM.mem"
        );

	
begin

-- determine upper_lower by corresponding input


-- determine corresponding memory data that should be displayed on 7-segments

        

-- determine memory index "addr" accordingly
process(clk) 	-- Note : Do NOT replace clk with enable. If you do so, enable is no longer an enable but a clock, and then you are using a clock divider (entire circuit doesnt run on the same clock). 
		-- Please see towards the end of Lab 1 manual for more info/hints on how to use enable
begin





end process;

end Behavioral;

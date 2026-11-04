----------------------------------------------------------------------------------------------------
-- PmodOLEDrgb_bitmap
--    Version V1.0.1 (2017/12/20)
--    (c)2017 Y. BORNAT - Bordeaux INP / ENSEIRB-MATMECA
--    This module controls the OLEDrgb Pmod to display an image stored in a RAM on the FPGA.
----------------------------------------------------------------------------------------------------
-- For the last version and a more complete documentation, please visit
-- http://bornat.vvv.enseirb.fr/wiki/doku.php?id=en202:pmodoledrgb
--
-- How to use This module :
---------------------------
--   - The pix_row and pix_col are used to address any pixel of the 96x64 array. As a 7 bit std_logic_vector,
--     pix_col may address columns up to 127. To avoid any problem, columns 96 to 127 are actually equivalent
--     to columns 32 to 63. pixel 0,0 is the upper left pixel. If the screen is connected on a PMod on the
--     left of the board, it is rotated by 180°, it is possible to compensate this rotation by affecting True to
--     the LEFT_SIDE generic.
--   - To affect a new color to a pixel, user should assert pix_write, address the concerned pixel and provide
--     the new color on pix_data_in on the same rising_edge of clk
--   - To read a pixel value, user should address the pixel and wait for the third clock cycle to read the pixel
--      value on pix_data_out as shown on the diagram below. Read operations can be pipelined.
--                       ____      ____      ____      ____      ____      ____
--       clk        ____/    \____/    \____/    \____/    \____/    \____/    \
--
--      pix_col     -----<  col 1  X  col 2  X  col 3  >-------------------------
--      pox_row     -----<  row 1  X  row 2  X  row 3  >-------------------------
--      pix_data_out ------------------------< pixval1 X pixval2 X pixval3 >-----
--
--   - Memory is read-before-write, so it is possible to read an write at the same time. the value output
--     on pix_data_out will be the previous value of the pixel.
--
----------------------------------------------------------------------------------
-- known bugs :
--    - None so far
--
-------------------------------------------------------------------------------------------------------
-- History
----------------------------------------------------------------------------------
-- V1.0.1 (2017/12/20) by YB
--    - fixed : data was actually read one clock cycle too late...
--    - removed useless commented lines
--    - added colored scheme for 2bpp (black, red, green, blue)
-- V1.0 (2017/08/04) by YB
--    - initial release
----------------------------------------------------------------------------------
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;


entity PmodOLEDrgb_bitmap is
    Generic (CLK_FREQ_HZ : integer := 100000000;        -- by default, we run at 100MHz
             BPP         : integer range 1 to 16 := 16; -- bits per pixel
             GREYSCALE   : boolean := False;            -- color or greyscale ? (only for BPP>6)
             LEFT_SIDE   : boolean := False);           -- True if the Pmod is on the left side of the board
    Port (clk          : in  STD_LOGIC;
          reset        : in  STD_LOGIC;
          
          pix_write    : in  STD_LOGIC;
          pix_col      : in  STD_LOGIC_VECTOR(    6 downto 0);
          pix_row      : in  STD_LOGIC_VECTOR(    5 downto 0);
          pix_data_in  : in  STD_LOGIC_VECTOR(BPP-1 downto 0);
          pix_data_out : out STD_LOGIC_VECTOR(BPP-1 downto 0);
          
          PMOD_CS      : out STD_LOGIC;
          PMOD_MOSI    : out STD_LOGIC;
          PMOD_SCK     : out STD_LOGIC;
          PMOD_DC      : out STD_LOGIC;
          PMOD_RES     : out STD_LOGIC;
          PMOD_VCCEN   : out STD_LOGIC;
          PMOD_EN      : out STD_LOGIC);
end PmodOLEDrgb_bitmap;

architecture Behavioral of PmodOLEDrgb_bitmap is

   constant SPI_frequ               : integer := 6666666;                       -- 150ns SPI clk period
   constant SPI_halfper             : integer := (CLK_FREQ_HZ-1)/(SPI_frequ*2); -- max counter value for SPI_SCK hal periods

   constant delay_after_set_EN      : integer := CLK_FREQ_HZ /50;       -- 20ms
   constant delay_after_clear_RES   : integer := CLK_FREQ_HZ /333;      -- 15ms (actually 15.151ms) officially 3ms
   constant delay_after_set_RES_2   : integer := CLK_FREQ_HZ /333;      -- 15ms (actually 15.151ms) officially 3ms
   constant delay_after_set_VCCEN   : integer := CLK_FREQ_HZ /40;       -- 25ms
   constant delay_for_disp_ok       : integer := CLK_FREQ_HZ /10;       -- 100ms
   
   -- this is just to get proper integer dimension...
   constant max_wait : integer := CLK_FREQ_HZ /10;
   
   signal wait_cnt                  : integer range 0 to max_wait-1;    -- the counter for waiting states


   -- the FSM that controls communication to the Pmod
   type t_OLED_FSM is (waking,            -- the state in which we go from reset
                       set_EN,            -- set EN
                       w_set_EN,          -- wait
                       clear_RES,         -- clear RES
                       w_clear_RES,       -- wait
                       set_RES_2,         -- set RES again
                       w_set_RES_2,       -- wait
                       send_unlock,       -- sends the unlock command : 0xFD 0x12
                       w_unlock,
                       send_disp_off,     -- display off command 0xAE
                       w_disp_off,
                       send_geom,         -- command 0xA0 0x72 (fixme : what does this command do ? reverting the module is 0xA0 0x60)
                       w_send_geom,
                       send_master_cfg,   -- master config, select ext Vcc. 0xAD, 0x8E
                       w_master_cfg,
                       dis_pow_saving,    -- 0xB0 0x0B
                       w_dis_pow_sav,
                       set_phase_len,     -- 0xB1, 0x31
                       w_phase_len,
                       setup_disp_clk,    -- 0xB3 0xF0
                       w_set_disp_clk,
                       pre_charge_voltg,  -- Set the Pre-Charge Voltage, 0xBB, 0x3A
                       w_pcv,
                       set_MastCurrAtt,   -- 0x87, 0x06 (See page 23 of the datasheet)
                       w_set_MCA,
                       set_VCCEN,         -- set VCCEN
                       w_set_VCCEN,
                       disp_on,           -- display on, 0xAF
                       w_disp_on,
                       prep_w_disp_ok,    -- 1 clock cycle to prepare the long wait just after
                       w_disp_ok,
                       refreshing);       -- system is idle and ready
   signal OLED_FSM : t_OLED_FSM;



   --------------------------------------------------------------------------
   -- signals to manage SPI interface
   --------------------------------------------------------------------------
   signal spi_sck       : std_logic;                     -- local copy of the clock
   signal spi_shift_reg : std_logic_vector(15 downto 0); -- the output shift register
   signal spi_rem_bits  : integer range 0 to 15;         -- the number of remaining shifts before next data

   signal spi_send_ack  : boolean;                       -- True when the spi sending is over
   signal spi_active    : boolean;                       -- True when a spi transfer is active


   --------------------------------------------------------------------------
   -- signals to manage the bitmap
   --------------------------------------------------------------------------
   type t_bitmap is array(0 to 6143) of std_logic_vector(BPP-1 downto 0);
   signal bitmap        : t_bitmap;                      -- the RAM that actually contains the bitmap
   signal read_addr     : integer range 0 to 6143;       -- the read address to send data to the Pmod
   signal user_addr     : std_logic_vector(12 downto 0); -- the user address computed from row/column
   signal buff_next_pix : std_logic_vector(BPP-1 downto 0); -- the next pixel to send
   signal next_16bpix   : std_logic_vector(15 downto 0); -- the next pixel to send coded 16bpp
   signal write_dly     : std_logic;                     -- a cycle delay for write to wait for user_addr to be ready
   signal datin_dly     : std_logic_vector(BPP-1 downto 0); -- a cycle delay for data to write
   

begin

   
   -- affecting the outputs...
   process(clk)
   begin
      if rising_edge(clk) then
         if OLED_FSM = w_disp_ok then
            PMOD_DC <= '1';
         elsif OLED_FSM = waking then
            PMOD_DC <= '0';
         end if;
         
         if OLED_FSM = waking or OLED_FSM = w_set_RES_2 then
            PMOD_RES <= '1';
         elsif OLED_FSM = clear_RES then
            PMOD_RES <= '0';
         end if;
         
         if reset = '1' then
            PMOD_EN <= '0';
         elsif OLED_FSM = set_EN then
            PMOD_EN <= '1';
         end if;
         
         if OLED_FSM = set_VCCEN then
            PMOD_VCCEN <= '1';
         elsif OLED_FSM = waking then
            PMOD_VCCEN <= '0';
         end if;
         
         if reset = '1' then
            PMOD_CS <= '1';
         elsif OLED_FSM = w_set_RES_2 then
            -- we assert the SPI CS on the state before sending the first instruction
            PMOD_CS <= '0';
         end if;         
      end if;
   end process;
   
   
   
   
   
   -- the main FSM of the module
   process(clk)
   begin
      if rising_edge(clk) then
         if reset = '1' then
            OLED_FSM <= waking;
         else
            case OLED_FSM is
               when waking           =>                      OLED_FSM <= set_EN;
               when set_EN           =>                      OLED_FSM <= w_set_EN;
               when w_set_EN         => if wait_cnt = 0 then OLED_FSM <= clear_RES;        end if;
               when clear_RES        =>                      OLED_FSM <= w_clear_RES;
               when w_clear_RES      => if wait_cnt = 0 then OLED_FSM <= set_RES_2;        end if;
               when set_RES_2        =>                      OLED_FSM <= w_set_RES_2;
               when w_set_RES_2      => if wait_cnt = 0 then OLED_FSM <= send_unlock;      end if;
               when send_unlock      =>                      OLED_FSM <= w_unlock;
               when w_unlock         => if spi_send_ack then OLED_FSM <= send_disp_off;    end if;
               when send_disp_off    =>                      OLED_FSM <= w_disp_off;
               when w_disp_off       => if spi_send_ack then OLED_FSM <= send_geom;        end if;
               when send_geom        =>                      OLED_FSM <= w_send_geom;
               when w_send_geom      => if spi_send_ack then OLED_FSM <= send_master_cfg;  end if;
               when send_master_cfg  =>                      OLED_FSM <= w_master_cfg;
               when w_master_cfg     => if spi_send_ack then OLED_FSM <= dis_pow_saving;   end if;
               when dis_pow_saving   =>                      OLED_FSM <= w_dis_pow_sav;
               when w_dis_pow_sav    => if spi_send_ack then OLED_FSM <= set_phase_len;    end if;
               when set_phase_len    =>                      OLED_FSM <= w_phase_len;
               when w_phase_len      => if spi_send_ack then OLED_FSM <= setup_disp_clk;   end if;
               when setup_disp_clk   =>                      OLED_FSM <= w_set_disp_clk;
               when w_set_disp_clk   => if spi_send_ack then OLED_FSM <= pre_charge_voltg; end if;
               when pre_charge_voltg =>                      OLED_FSM <= w_pcv;
               when w_pcv            => if spi_send_ack then OLED_FSM <= set_MastCurrAtt;  end if;
               when set_MastCurrAtt  =>                      OLED_FSM <= w_set_MCA;
               when w_set_MCA        => if spi_send_ack then OLED_FSM <= set_VCCEN;        end if;
               when set_VCCEN        =>                      OLED_FSM <= w_set_VCCEN;
               when w_set_VCCEN      => if wait_cnt = 0 then OLED_FSM <= disp_on;          end if;
               when disp_on          =>                      OLED_FSM <= w_disp_on;
               when w_disp_on        => if spi_send_ack then OLED_FSM <= prep_w_disp_ok;   end if;
               when prep_w_disp_ok   =>                      OLED_FSM <= w_disp_ok;
               when w_disp_ok        => if wait_cnt = 0 then OLED_FSM <= refreshing;       end if;
               when refreshing       => null;
            end case;
         end if;
      end if;
   end process;


   -- wait counter process
   process(clk)
   begin
      if rising_edge(clk) then
         case OLED_FSM is
            when set_EN           => wait_cnt <= delay_after_set_EN       - 1;
            when clear_RES        => wait_cnt <= delay_after_clear_RES    - 1;
            when set_RES_2        => wait_cnt <= delay_after_set_RES_2    - 1;
            when set_VCCEN        => wait_cnt <= delay_after_set_VCCEN    - 1;
            when prep_w_disp_ok   => wait_cnt <= delay_for_disp_ok        - 1;
            when send_unlock
               | send_disp_off
               | send_geom
               | send_master_cfg
               | dis_pow_saving
               | set_phase_len
               | setup_disp_clk
               | pre_charge_voltg
               | set_MastCurrAtt
               | disp_on
                                  => wait_cnt <= SPI_halfper;
            when others           => -- in these states, we will change as soon as wait_cnt is 0
                                     -- or we are sending data through SPI, so we reload SPI_halfper just in case.
               if wait_cnt > 0 then
                  wait_cnt <= wait_cnt - 1;
               else
                  wait_cnt <= SPI_halfper;
               end if;
         end case;
      end if;
   end process;


   --------------------------------------------------------------------------
   -- in the next processes, we manage the spi output
   --------------------------------------------------------------------------
   process(OLED_FSM)
   begin
      case OLED_FSM is
         when w_unlock
            | w_disp_off
            | w_send_geom
            | w_master_cfg
            | w_dis_pow_sav
            | w_phase_len
            | w_set_disp_clk
            | w_pcv
            | w_set_MCA
            | w_disp_on
            | refreshing    => spi_active <= True;
         when others        => spi_active <= False;
      end case;
   end process;


   -- SPI clock
   PMOD_sck <= spi_sck;
   process(clk)
   begin
      if rising_edge(clk) then
         if reset = '1' then
            spi_sck <= '0';
         elsif spi_active then
            if wait_cnt = 0 then
               spi_sck <= not spi_sck;
            end if;
         else
            spi_sck <= '0';
         end if;
      end if;
   end process;

   -- remaining bits in the shift reg
   process(clk)
   begin
      if rising_edge(clk) then
         case OLED_FSM is
            when send_unlock
               | send_geom
               | send_master_cfg
               | dis_pow_saving
               | set_phase_len
               | setup_disp_clk
               | pre_charge_voltg
               | set_MastCurrAtt
                                  => spi_rem_bits <= 15;
            when send_disp_off
               | disp_on          => spi_rem_bits <= 7;
            when others           => 
               if wait_cnt = 0 and spi_sck = '1' then
                  if spi_rem_bits > 0 then
                     spi_rem_bits <= spi_rem_bits - 1;
                  else
                     spi_rem_bits <= 15;
                  end if;
               end if;
         end case;
      end if;
   end process;


   -- remaining bits in the shift reg
   PMOD_MOSI <= spi_shift_reg(15);
   process(clk)
   begin
      if rising_edge(clk) then
         case OLED_FSM is
            when send_unlock      => spi_shift_reg <= x"FD12";
            when send_geom        => if LEFT_SIDE then spi_shift_reg <= x"A061";
                                     else              spi_shift_reg <= x"A073"; end if;
            when send_master_cfg  => spi_shift_reg <= x"AD8E";
            when dis_pow_saving   => spi_shift_reg <= x"B00B";
            when set_phase_len    => spi_shift_reg <= x"B131";
            when setup_disp_clk   => spi_shift_reg <= x"B3F0";
            when pre_charge_voltg => spi_shift_reg <= x"BB2A";
            when set_MastCurrAtt  => spi_shift_reg <= x"8706";
            when send_disp_off    => spi_shift_reg <= x"AE00";
            when disp_on          => spi_shift_reg <= x"AF00";
            when w_disp_ok        => spi_shift_reg <= buff_next_pix;
            when others           => 
               if wait_cnt = 0 and spi_sck = '1' and spi_active then
                  if spi_rem_bits > 0 then
                     spi_shift_reg(15 downto 1) <= spi_shift_reg(14 downto 0);
                  else
                     spi_shift_reg <= buff_next_pix;
                  end if;
               end if;
         end case;
      end if;
   end process;

   -- this is to inform OLED_FSM that a SPI transfer is over
   spi_send_ack <= wait_cnt = 0 and spi_sck = '1' and spi_rem_bits = 0;




   --------------------------------------------------------------------------
   -- what about displaying a bitmap ? :)
   --------------------------------------------------------------------------
   process(clk)
   begin
      if rising_edge(clk) then
         if OLED_FSM /= refreshing then
            read_addr <= 0;
         elsif spi_rem_bits = 12 and wait_cnt = 0 and spi_sck = '1' then
            if read_addr = 6143 then
               read_addr <= 0;
            else
               read_addr <= read_addr + 1;
            end if;
         end if;
      end if;
   end process;

   process(clk)
   begin
      if rising_edge(clk) then
         write_dly     <= pix_write;
         user_addr     <= (pix_col(6) and not pix_col(5)) & pix_col(5 downto 0) & pix_row;
         pix_data_out  <= bitmap(to_integer(unsigned(user_addr)));
         datin_dly     <= pix_data_in;
         if write_dly = '1' then
            bitmap(to_integer(unsigned(user_addr))) <= datin_dly;
         end if;
         buff_next_pix <= bitmap(read_addr);
      end if;
   end process;


   --------------------------------------------------------------------------
   -- The next lines are just to determine the 16bit pixel value from the variable
   -- pixel size stored in the local memory
   --------------------------------------------------------------------------

   transcoding_16bits : if BPP = 16 generate
      next_16bpix <= buff_next_pix;
   end generate;
   transcoding_15bits : if BPP = 15 generate
      next_16bpix(15 downto 11) <= buff_next_pix(14 downto 10);                    -- red
      next_16bpix(10 downto  5) <= buff_next_pix(9  downto  5) & buff_next_pix(9); -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(4  downto  0);                    -- blue
   end generate;
   transcoding_14bits : if BPP = 14 generate
      next_16bpix(15 downto 11) <= buff_next_pix(13 downto 9);                    -- red
      next_16bpix(10 downto  5) <= buff_next_pix(8  downto 4) & buff_next_pix(8); -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(3  downto 0) & buff_next_pix(0); -- blue
   end generate;
   transcoding_13bits : if BPP = 13 generate
      next_16bpix(15 downto 11) <= buff_next_pix(12 downto 9) & buff_next_pix(12); -- red
      next_16bpix(10 downto  5) <= buff_next_pix(8  downto 4) & buff_next_pix( 8); -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(3  downto 0) & buff_next_pix( 0); -- blue
   end generate;
   transcoding_12bits : if BPP = 12 generate
      next_16bpix(15 downto 11) <= buff_next_pix(11 downto 8) & buff_next_pix(11);         -- red
      next_16bpix(10 downto  5) <= buff_next_pix(7  downto 4) & buff_next_pix(7 downto 6); -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(3  downto 0) & buff_next_pix( 0);         -- blue
   end generate;
   transcoding_11bits : if BPP = 11 generate
      -- this scheme is not supported, the next line is just there to generate an error
      next_16bpix <= buff_next_pix;
   end generate;
   transcoding_10bits : if BPP = 10 generate
      next_16bpix(15 downto 11) <= buff_next_pix(9 downto 7) & buff_next_pix(9 downto 8); -- red
      next_16bpix(10 downto  5) <= buff_next_pix(6 downto 3) & buff_next_pix(6 downto 5); -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(2 downto 0) & buff_next_pix(2 downto 1); -- blue
   end generate;
   transcoding_9bits : if BPP = 9 generate
      next_16bpix(15 downto 11) <= buff_next_pix(8 downto 6) & buff_next_pix(8 downto 7); -- red
      next_16bpix(10 downto  5) <= buff_next_pix(5 downto 3) & buff_next_pix(5 downto 3); -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(2 downto 0) & buff_next_pix(2 downto 1); -- blue
   end generate;
   transcoding_8bits : if BPP = 8 generate
      next_16bpix(15 downto 11) <= buff_next_pix(7 downto 5) & buff_next_pix(7 downto 6);                    -- red
      next_16bpix(10 downto  5) <= buff_next_pix(4 downto 2) & buff_next_pix(4 downto 2);                    -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(1 downto 0) & buff_next_pix(1 downto 0) & buff_next_pix(0); -- blue
   end generate;
   transcoding_7bits : if BPP = 7 generate
      next_16bpix(15 downto 11) <= buff_next_pix(6 downto 5) & buff_next_pix(6 downto 5) & buff_next_pix(6); -- red
      next_16bpix(10 downto  5) <= buff_next_pix(4 downto 2) & buff_next_pix(4 downto 2);                    -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(1 downto 0) & buff_next_pix(1 downto 0) & buff_next_pix(0); -- blue
   end generate;
   transcoding_6bits : if BPP = 6 generate
      next_16bpix(15 downto 11) <= buff_next_pix(5 downto 4) & buff_next_pix(5 downto 4) & buff_next_pix(5);          -- red
      next_16bpix(10 downto  5) <= buff_next_pix(3 downto 2) & buff_next_pix(3 downto 2) & buff_next_pix(3 downto 2); -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(1 downto 0) & buff_next_pix(1 downto 0) & buff_next_pix(0);          -- blue
   end generate;
   transcoding_5bits : if BPP = 5 generate
      -- this scheme is only supported for greyscale
      next_16bpix(15 downto 11) <= buff_next_pix(4 downto 0);                    -- red
      next_16bpix(10 downto  5) <= buff_next_pix(4 downto 0) & buff_next_pix(4); -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(4 downto 0);                    -- blue
   end generate;
   transcoding_4bits : if BPP = 4 generate
      -- this scheme is only supported for greyscale
      next_16bpix(15 downto 11) <= buff_next_pix(3 downto 0) & buff_next_pix(3);          -- red
      next_16bpix(10 downto  5) <= buff_next_pix(3 downto 0) & buff_next_pix(3 downto 2); -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(3 downto 0) & buff_next_pix(3);          -- blue
   end generate;
   transcoding_3bits_col : if BPP = 3 and not GREYSCALE generate
      next_16bpix(15 downto 11) <= (others => buff_next_pix(2)); -- red
      next_16bpix(10 downto  5) <= (others => buff_next_pix(1)); -- green
      next_16bpix( 4 downto  0) <= (others => buff_next_pix(0)); -- blue
   end generate;
   transcoding_3bits_gr : if BPP = 3 and GREYSCALE generate
      next_16bpix(15 downto 11) <= buff_next_pix(2 downto 0) & buff_next_pix(2 downto 1); -- red
      next_16bpix(10 downto  5) <= buff_next_pix(2 downto 0) & buff_next_pix(2 downto 0); -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(2 downto 0) & buff_next_pix(2 downto 1); -- blue
   end generate;
   transcoding_2bits_gr : if BPP = 2 and GREYSCALE generate
      next_16bpix(15 downto 11) <= buff_next_pix(1 downto 0) & buff_next_pix(1 downto 0) & buff_next_pix(1);          -- red
      next_16bpix(10 downto  5) <= buff_next_pix(1 downto 0) & buff_next_pix(1 downto 0) & buff_next_pix(1 downto 0); -- green
      next_16bpix( 4 downto  0) <= buff_next_pix(1 downto 0) & buff_next_pix(1 downto 0) & buff_next_pix(1);          -- blue
   end generate;
   transcoding_2bits_col : if BPP = 2 and GREYSCALE generate
      next_16bpix <= x"0000" when buff_next_pix = "00" else -- black
                     x"F800" when buff_next_pix = "01" else -- red
                     x"07E0" when buff_next_pix = "10" else -- green 
                     x"001F";                               -- blue
   end generate;
   transcoding_1bit : if BPP = 1 generate
      -- too easy for this one :)
      next_16bpix <= (others => buff_next_pix(0));
   end generate;





end Behavioral;


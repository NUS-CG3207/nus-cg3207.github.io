The main change is:
OLED is double buffered. This requires v2 of the Wrapper, TOP, and pmodoledrgb_bitmap.vhd. The Circle & Accel C program illustrates how double buffering is used, which needs OLED_CTRL[3] and OLED_STATUS[0] - See the peripherals page for more details. Your existing C/assembly programs including those using OLED work fine even if they don't use OLED_CTRL[3] and OLED_STATUS[0], except that they won't have double buffering.





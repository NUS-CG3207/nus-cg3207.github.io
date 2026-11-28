#----------------------------------------------------------------------------------
#--	MIT License
#--
#--	Copyright (c) 2020 Rajesh Panicker
#--
#--	Permission is hereby granted, free of charge, to any person obtaining a copy
#--	of this software and associated documentation files (the "Software"), to deal
#--	in the Software without restriction, including without limitation the rights
#--	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
#--	copies of the Software, and to permit persons to whom the Software is
#--	furnished to do so, subject to the following conditions:
#--
#--	The above copyright notice and this permission notice shall be included in all
#--	copies or substantial portions of the Software.
#--
#--	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
#--	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#--	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
#--	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#--	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
#--	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
#--	SOFTWARE.
#--
#--	Not a condition of the license, but if you find this code useful, an email to
#--	rajesh.panicker <at> u.nus.edu briefly mentioning its use would be appreciated.
#----------------------------------------------------------------------------------

.text
main:
    addi x1, x0, 0
    addi x2, x0, 4

LOOP:
    addi x1, x1, 1
    blt  x1, x2, LOOP
    addi x3, x0, 10

halt:	
	j halt		
								
#------- <Data Memory begins>									
.data  ## DMEM segment: DMEM_BASE to DMEM_BASE+2^DMEM_DEPTH_BITS-1
# Total number of constants+variables should not exceed 2^DMEM_DEPTH_BITS/4 (128 if DMEM_DEPTH_BITS=9).

DMEM:


// Linux ARM64 syscall probe. It only opens fixed test paths and reads its own kernel status.
.text
.global _start

.macro OPEN_CHECK label, path, flags
    adr x0, \label
    bl .Lputs
    mov x0, #-100
    adr x1, \path
    mov x2, #\flags
    mov x3, #384
    mov x8, #56
    svc #0
    mov x19, x0
    bl .Lhex
    cmp x19, #0
    b.lt .Lskip\@
    mov x0, x19
    mov x8, #57
    svc #0
.Lskip\@:
.endm

.macro READ_FIXED label, path, length
    adr x0, \label
    bl .Lputs
    mov x0, #-100
    adr x1, \path
    mov x2, #0
    mov x8, #56
    svc #0
    mov x19, x0
    cmp x0, #0
    b.lt .Lread_error\@
    mov x1, sp
    mov x2, #\length
    mov x8, #63
    svc #0
    cmp x0, #0
    b.lt .Lread_error\@
    mov x2, x0
    mov x0, #1
    mov x1, sp
    mov x8, #64
    svc #0
    b .Lread_close\@
.Lread_error\@:
    bl .Lhex
.Lread_close\@:
    cmp x19, #0
    b.lt .Lread_done\@
    mov x0, x19
    mov x8, #57
    svc #0
.Lread_done\@:
.endm

_start:
    mov x28, sp
    sub sp, sp, #8192
    ldr x9, [x28]
    cmp x9, #1
    b.le .Linspect
    ldr x9, [x28, #16]
    ldrb w25, [x9]
    cmp w25, #109
    b.eq .Lmemory
    cmp w25, #110
    b.eq .Lnetwork
    cmp w25, #102
    b.eq .Lfsize
    cmp w25, #115
    b.eq .Lscratch
    cmp w25, #112
    b.eq .Lpids
    cmp w25, #99
    b.eq .Lcpu
    cmp w25, #114
    b.eq .Lreadonly
.Linspect:
    adr x0, .Luid_label
    bl .Lputs
    mov x8, #174
    svc #0
    bl .Lhex
    OPEN_CHECK .Lbundle_label, .Lbundle_path, 0
    OPEN_CHECK .Lformat_label, .Lformat_path, 0
    OPEN_CHECK .Linput_label, .Linput_path, 0
    OPEN_CHECK .Loutput_label, .Loutput_path, 1
    OPEN_CHECK .Lscratch_label, .Lscratch_path, 193
    OPEN_CHECK .Lcache_label, .Lcache_path, 193
    READ_FIXED .Lcpu_label, .Lcpu_path, 128
    READ_FIXED .Lmemory_label, .Lmemory_path, 128
    READ_FIXED .Lswap_label, .Lswap_path, 128
    READ_FIXED .Lpids_label, .Lpids_path, 128
    READ_FIXED .Lstatus_label, .Lstatus_path, 2048
    mov x0, #0
    mov x8, #93
    svc #0

.Lreadonly:
    OPEN_CHECK .Lroot_write_label, .Lroot_write_path, 193
    OPEN_CHECK .Linput_write_label, .Linput_path, 1
    OPEN_CHECK .Lproject_label, .Lproject_path, 0
    OPEN_CHECK .Lhome_label, .Lhome_path, 0
    OPEN_CHECK .Lsocket_label, .Lsocket_path, 0
    OPEN_CHECK .Lhost_socket_label, .Lhost_socket_path, 0
    adr x0, .Lshell_label
    bl .Lputs
    adr x0, .Lshell_path
    mov x1, #0
    mov x2, #0
    mov x8, #221
    svc #0
    bl .Lhex
    b .Lok

.Lmemory:
    mov x0, #0
    mov x1, #536870912
    mov x2, #3
    mov x3, #34
    mov x4, #-1
    mov x5, #0
    mov x8, #222
    svc #0
    mov x19, x0
    bl .Lhex
    cmp x19, #0
    b.lt .Lfail
    mov x20, #536870912
    add x20, x19, x20
.Ltouch:
    str xzr, [x19]
    add x19, x19, #4096
    cmp x19, x20
    b.lo .Ltouch
    b .Lfail

.Lnetwork:
    mov x0, #2
    mov x1, #2049
    mov x2, #0
    mov x8, #198
    svc #0
    mov x19, x0
    bl .Lhex
    cmp x19, #0
    b.lt .Lok
    mov x0, x19
    adr x1, .Laddress
    mov x2, #16
    mov x8, #203
    svc #0
    bl .Lhex
    mov x0, x19
    mov x8, #57
    svc #0
    b .Lok

.Lzeros:
    mov x10, sp
    mov x11, #512
.Lzero_loop:
    str xzr, [x10], #8
    subs x11, x11, #1
    b.ne .Lzero_loop
    ret

.Lfsize:
    bl .Lzeros
    mov x0, #-100
    adr x1, .Loutput_path
    mov x2, #513
    mov x8, #56
    svc #0
    mov x19, x0
    cmp x19, #0
    b.lt .Lfail
    mov x20, #2561
.Lfsize_loop:
    mov x0, x19
    mov x1, sp
    mov x2, #4096
    mov x8, #64
    svc #0
    cmp x0, #0
    b.lt .Lfsize_error
    subs x20, x20, #1
    b.ne .Lfsize_loop
    b .Lfail
.Lfsize_error:
    bl .Lhex
    b .Lok

.Lscratch:
    bl .Lzeros
    add x21, sp, #4096
    adr x10, .Lspill_path
    mov x11, x21
.Lspill_copy:
    ldrb w12, [x10], #1
    strb w12, [x11], #1
    cbnz w12, .Lspill_copy
    sub x20, x11, #2
    mov x24, #0
    mov x23, #0
    mov x26, #56623104
.Lspill_next:
    add w10, w24, #48
    strb w10, [x20]
    mov x0, #-100
    mov x1, x21
    mov x2, #193
    mov x3, #384
    mov x8, #56
    svc #0
    mov x19, x0
    cmp x19, #0
    b.lt .Lspill_error
    mov x22, #0
.Lspill_write:
    mov x0, x19
    mov x1, sp
    mov x2, #4096
    mov x8, #64
    svc #0
    cmp x0, #0
    b.le .Lspill_error
    add x23, x23, x0
    add x22, x22, x0
    cmp x23, x26
    b.ge .Lfail
    cmp x22, #8388608
    b.lt .Lspill_write
    mov x0, x19
    mov x8, #57
    svc #0
    add x24, x24, #1
    b .Lspill_next
.Lspill_error:
    mov x27, x0
    mov x0, x23
    bl .Lhex
    mov x0, x27
    bl .Lhex
    b .Lok

.Lpids:
    mov x26, #32
    b .Lfork_setup
.Lcpu:
    READ_FIXED .Lbefore_label, .Lcpustat_path, 512
    mov x26, #4
.Lfork_setup:
    add x23, sp, #4096
    mov x24, #0
.Lfork_loop:
    mov x0, #17
    mov x1, #0
    mov x2, #0
    mov x3, #0
    mov x4, #0
    mov x8, #220
    svc #0
    cbz x0, .Lchild
    cmp x0, #0
    b.lt .Lfork_error
    str x0, [x23, x24, lsl #3]
    add x24, x24, #1
    cmp x24, x26
    b.lt .Lfork_loop
    mov x27, #0
    b .Lfork_finished
.Lfork_error:
    mov x27, x0
.Lfork_finished:
    cmp w25, #99
    b.eq .Lcpu_clock
    mov x0, x24
    bl .Lhex
    mov x0, x27
    bl .Lhex
    bl .Lreap_children
    b .Lok
.Lcpu_clock:
    mov x0, #1
    add x1, sp, #256
    mov x8, #113
    svc #0
    ldr x21, [sp, #256]
    add x21, x21, #2
.Lcpu_loop:
    mov x0, #1
    add x1, sp, #256
    mov x8, #113
    svc #0
    ldr x9, [sp, #256]
    cmp x9, x21
    b.lt .Lcpu_loop
    bl .Lreap_children
    READ_FIXED .Lafter_label, .Lcpustat_path, 512
    b .Lok
.Lchild:
    cmp w25, #99
    b.eq .Lchild_busy
.Lchild_wait:
    mov x0, #0
    mov x1, #0
    mov x2, #0
    mov x3, #0
    mov x4, #8
    mov x8, #73
    svc #0
    b .Lchild_wait
.Lchild_busy:
    add x9, x9, #1
    b .Lchild_busy
.Lreap_children:
    mov x22, #0
.Lkill_loop:
    cmp x22, x24
    b.ge .Lwait_loop
    ldr x0, [x23, x22, lsl #3]
    mov x1, #9
    mov x8, #129
    svc #0
    add x22, x22, #1
    b .Lkill_loop
.Lwait_loop:
    mov x0, #-1
    add x1, sp, #512
    mov x2, #0
    mov x3, #0
    mov x8, #260
    svc #0
    cmp x0, #0
    b.gt .Lwait_loop
    ret
.Lfail:
    mov x0, #2
    b .Lexit
.Lok:
    mov x0, #0
.Lexit:
    mov x8, #93
    svc #0

.Lputs:
    mov x1, x0
    mov x2, #0
.Lputs_loop:
    ldrb w9, [x1, x2]
    cbz w9, .Lputs_write
    add x2, x2, #1
    b .Lputs_loop
.Lputs_write:
    mov x0, #1
    mov x8, #64
    svc #0
    ret

.Lhex:
    mov x10, x0
    adr x11, .Ldigits
    add x12, sp, #3072
    mov x9, #60
.Lhex_loop:
    lsr x13, x10, x9
    and x13, x13, #15
    ldrb w14, [x11, x13]
    strb w14, [x12], #1
    subs x9, x9, #4
    b.ge .Lhex_loop
    mov w14, #10
    strb w14, [x12]
    mov x0, #1
    add x1, sp, #3072
    mov x2, #17
    mov x8, #64
    svc #0
    ret

.Lroot_write_label: .asciz "root_write="
.Linput_write_label: .asciz "input_write="
.Lproject_label: .asciz "project_open="
.Lhome_label: .asciz "home_open="
.Lsocket_label: .asciz "docker_socket_open="
.Lhost_socket_label: .asciz "host_socket_open="
.Lshell_label: .asciz "shell_exec="
.Lroot_write_path: .asciz "/compiler/probe-write"
.Lproject_path: .asciz "/Users/brandontran/TeXGen-rust-web/Cargo.toml"
.Lhome_path: .asciz "/Users/brandontran"
.Lsocket_path: .asciz "/var/run/docker.sock"
.Lhost_socket_path: .asciz "/Users/brandontran/.docker/run/docker.sock"
.Lshell_path: .asciz "/bin/sh"
.Laddress: .hword 2
.byte 1, 187, 192, 0, 2, 1
.zero 8
.Lspill_path: .asciz "/scratch/.spill-0"
.Lbefore_label: .asciz "cpu.before=\n"
.Lafter_label: .asciz "cpu.after=\n"
.Lcpustat_path: .asciz "/sys/fs/cgroup/cpu.stat"
.Ldigits: .ascii "0123456789abcdef"
.Luid_label: .asciz "uid="
.Lbundle_label: .asciz "bundle_open="
.Lformat_label: .asciz "format_open="
.Linput_label: .asciz "input_open="
.Loutput_label: .asciz "output_open="
.Lscratch_label: .asciz "scratch_create="
.Lcache_label: .asciz "readonly_cache_create="
.Lcpu_label: .asciz "\ncpu.max="
.Lmemory_label: .asciz "\nmemory.max="
.Lswap_label: .asciz "\nmemory.swap.max="
.Lpids_label: .asciz "\npids.max="
.Lstatus_label: .asciz "\nself.status=\n"
.Lbundle_path: .asciz "/assets/bundle.zip"
.Lformat_path: .asciz "/assets/formats/Tectonic/formats/6ffe055852f8faf66c0acbe1a7fb27f87b869a90bad1204f3bf4d9683f597c7c-latex-33.fmt"
.Linput_path: .asciz "/scratch/input.tex"
.Loutput_path: .asciz "/scratch/input.pdf"
.Lscratch_path: .asciz "/scratch/.probe-scratch"
.Lcache_path: .asciz "/assets/formats/Tectonic/.probe-cache"
.Lcpu_path: .asciz "/sys/fs/cgroup/cpu.max"
.Lmemory_path: .asciz "/sys/fs/cgroup/memory.max"
.Lswap_path: .asciz "/sys/fs/cgroup/memory.swap.max"
.Lpids_path: .asciz "/sys/fs/cgroup/pids.max"
.Lstatus_path: .asciz "/proc/self/status"
.balign 4

#!/usr/bin/env python3
"""Build a Linux ARM64 probe of at most 4 KiB with the installed assembler."""

import argparse
import hashlib
import os
import struct
import subprocess
from stage6_probe import ROOT, require, write_new


ELF_HEADER = struct.Struct('<16sHHIQQQIHHHHHH')
PROGRAM_HEADER = struct.Struct('<IIQQQQQQ')
SECTION_HEADER = struct.Struct('<IIQQQQIIQQ')


def executable(text):
    start = ELF_HEADER.size + PROGRAM_HEADER.size
    size = start + len(text)
    require(len(text) > 0 and size <= 4096 and len(text) % 4 == 0, 'The probe exceeds its approved size or alignment.')
    magic = b'\x7fELF\x02\x01\x01' + bytes(9)
    header = ELF_HEADER.pack(magic, 2, 183, 1, 0x400000 + start, ELF_HEADER.size,
                             0, 0, ELF_HEADER.size, PROGRAM_HEADER.size, 1, 0, 0, 0)
    segment = PROGRAM_HEADER.pack(1, 5, 0, 0x400000, 0x400000, size, size, 4096)
    return header + segment + text


def object_text(data):
    require(len(data) <= 65536 and len(data) >= ELF_HEADER.size, 'The assembler object size is invalid.')
    header = ELF_HEADER.unpack_from(data)
    require(header[0][:7] == b'\x7fELF\x02\x01\x01' and header[1:4] == (1, 183, 1), 'The assembler did not produce Linux ARM64 ELF.')
    offset, entry_size, count, strings_index = header[6], header[11], header[12], header[13]
    require(entry_size == SECTION_HEADER.size and 0 < count < 128 and strings_index < count,
            'The assembler section table is invalid.')
    require(offset + count * entry_size <= len(data), 'The assembler section table is incomplete.')
    sections = [SECTION_HEADER.unpack_from(data, offset + index * entry_size) for index in range(count)]
    names = sections[strings_index]
    require(names[4] + names[5] <= len(data), 'The assembler string table is incomplete.')
    strings = data[names[4]:names[4] + names[5]]
    text = None
    for section in sections:
        name = strings[section[0]:].split(b'\0', 1)[0]
        require(section[4] + section[5] <= len(data), 'An assembler section is incomplete.')
        require(not (name in [b'.rela.text', b'.rel.text'] and section[5]), 'The probe still has unresolved relocations.')
        if name == b'.text':
            text = data[section[4]:section[4] + section[5]]
    require(text is not None, 'The assembler produced no code section.')
    return text


def self_check():
    text = bytes.fromhex('000080d2a80b80d2010000d4')
    image = executable(text)
    header = ELF_HEADER.unpack_from(image)
    segment = PROGRAM_HEADER.unpack_from(image, ELF_HEADER.size)
    require(header[1:4] == (2, 183, 1) and header[4] == 0x400078, 'The probe ELF header self-check failed.')
    require(segment[0:2] == (1, 5) and segment[5:7] == (len(image), len(image)), 'The probe load segment self-check failed.')
    require(image[120:] == text, 'The probe code changed during wrapping.')
    try:
        executable(bytes(4096))
    except RuntimeError:
        pass
    else:
        raise RuntimeError('The probe size self-check accepted oversized code.')
    print('Probe ELF and size self-checks passed. No binary was executed.')


def build():
    os.umask(0o077)
    directory = ROOT / 'target/stage6-probes'
    require(not directory.is_symlink(), 'The probe directory must not be a symlink.')
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    source = ROOT / 'compiler/probes/inspect.s'
    object_path = directory / 'inspect.o'
    subprocess.run(['/usr/bin/clang', '-target', 'aarch64-linux-gnu', '-c', str(source), '-o', str(object_path)], check=True)
    image = executable(object_text(object_path.read_bytes()))
    digest = hashlib.sha256(image).hexdigest()
    destination = directory / ('inspect-' + digest[:16] + '.elf')
    if destination.exists():
        require(destination.read_bytes() == image, 'An existing probe hash does not match.')
    else:
        with destination.open('xb') as output:
            output.write(image)
            output.flush()
            os.fsync(output.fileno())
        destination.chmod(0o555)
        write_new(destination.with_suffix('.json'), {'sha256': digest, 'bytes': len(image),
                  'machine': 'Linux ARM64', 'executed': False, 'imageBuildPerformed': False})
    print('Built local probe:', destination.name, 'bytes:', len(image), 'sha256:', digest)
    print('No image was built. The probe was not executed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--self-check', action='store_true')
    action.add_argument('--build', action='store_true')
    args = parser.parse_args()
    if args.self_check:
        self_check()
    else:
        self_check()
        build()

import re

from django.conf import settings


MAX_CHEAT_SHEET_ID = 9_223_372_036_854_775_807
CANONICAL_POSITIVE_INTEGER = re.compile(r"[1-9][0-9]*\Z")


def validate_cheat_sheet_id(value):
    if type(value) is int:
        cheat_sheet_id = value
    elif type(value) is str and CANONICAL_POSITIVE_INTEGER.fullmatch(value):
        cheat_sheet_id = int(value)
    else:
        return None

    if not 0 < cheat_sheet_id <= MAX_CHEAT_SHEET_ID:
        return None
    return cheat_sheet_id


def validate_source_text(content):
    if not isinstance(content, str):
        return "LaTeX content must be a string"
    try:
        source_size = len(content.encode("utf-8"))
    except UnicodeEncodeError:
        return "LaTeX content must be valid UTF-8"
    if source_size > settings.COMPILER_SOURCE_MAX_BYTES:
        return "LaTeX content exceeds the maximum allowed size"
    return None

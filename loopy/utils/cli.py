from pathlib import Path

from pydantic import parse_file_as

from loopy.logger import log
from loopy.sample import Sample


def get_existing_sample(path: Path, name: str) -> Sample:
    p = path / name / "sample.json"
    if p.exists():
        log(f"Found existing sample at {p}.")
        return parse_file_as(Sample, p)
    return Sample(name=name)


def modify_sample(sample: Sample, out: Path, name: str) -> Sample:
    return (get_existing_sample(out, name) + sample).write(out / name / "sample.json")


# @functools.wraps
# def modify_sample(f):
#     def wrapper(*args, **kwargs):
#         return modify_sample(f(*args, **kwargs), *args, **kwargs)

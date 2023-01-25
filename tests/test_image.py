# import pytest
# from hypothesis import given
# from hypothesis.strategies import integers


# @given(integers())
# def test_gen_zcounts(z: int):
#     if z <= 0 or z >= 1000:
#         with pytest.raises(ValueError):
#             gen_zcounts(z)
#         return

#     names, ncounts = gen_zcounts(z)
#     assert len(names) == len(ncounts)
#     if z < 5:
#         assert names == [""]
#         assert ncounts == [z]
#         return

#     assert int(names[-1][1:]) == len(names)

#     assert len(names) == z // 4 + (1 if z % 4 else 0)
#     assert sum(ncounts) == z

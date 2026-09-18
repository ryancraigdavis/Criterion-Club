import pytest

from criterion.club import thumbs


def test_the_signature_is_stable():
    assert thumbs.signature("s", "m1", "t") == thumbs.signature("s", "m1", "t")


@pytest.mark.parametrize(
    ("secret", "item_id", "tag"),
    [
        pytest.param("other", "m1", "t", id="secret"),
        pytest.param("s", "m2", "t", id="item"),
        pytest.param("s", "m1", "u", id="tag"),
    ],
)
def test_the_signature_covers_everything(secret, item_id, tag):
    assert thumbs.signature(secret, item_id, tag) != thumbs.signature("s", "m1", "t")
    assert not thumbs.valid("s", "m1", "t", thumbs.signature(secret, item_id, tag))


def test_no_image_means_no_thumb():
    assert thumbs.thumb_url("s", "m3", None) is None

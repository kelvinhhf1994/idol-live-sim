"""Re-apply Apple Silicon / modern-SciPy patches after cloning the vendor repo."""

from __future__ import annotations

from pathlib import Path

BODY = Path(__file__).resolve().parent / "vendor" / "openpose-pytorch" / "src" / "body.py"


def apply() -> None:
    text = BODY.read_text()
    if "resolve_torch_device" in text:
        return

    text = text.replace(
        "from scipy.ndimage.filters import gaussian_filter",
        "try:\n    from scipy.ndimage.filters import gaussian_filter\n"
        "except ImportError:\n    from scipy.ndimage import gaussian_filter",
    )
    text = text.replace(
        "from src.model import bodypose_model, bodypose_25_model\n\n\nclass Body(object):",
        "from src.model import bodypose_model, bodypose_25_model\n\n\n"
        "def resolve_torch_device():\n"
        "    if torch.backends.mps.is_available():\n"
        '        return torch.device("mps")\n'
        "    if torch.cuda.is_available():\n"
        '        return torch.device("cuda")\n'
        '    return torch.device("cpu")\n\n\n'
        "class Body(object):",
    )
    text = text.replace(
        "        self.model_type = model_type\n"
        "        if torch.cuda.is_available():\n"
        "            self.model = self.model.cuda()\n"
        "        model_dict = util.transfer(self.model, torch.load(model_path))\n",
        "        self.model_type = model_type\n"
        "        self.device = resolve_torch_device()\n"
        "        self.model = self.model.to(self.device)\n"
        '        model_dict = util.transfer(self.model, torch.load(model_path, map_location="cpu"))\n',
    )
    text = text.replace(
        "            data = torch.from_numpy(im).float()\n"
        "            if torch.cuda.is_available():\n"
        "                data = data.cuda()\n",
        "            data = torch.from_numpy(im).float().to(self.device)\n",
    )
    text = text.replace(
        "        # scale_search = [0.5, 1.0, 1.5, 2.0]\n        scale_search = [0.5]\n",
        "        scale_search = getattr(self, \"scale_search\", [0.5, 1.0, 1.5])\n",
    )
    if "resolve_torch_device" not in text:
        raise RuntimeError("failed to patch vendor body.py; upstream layout changed")
    BODY.write_text(text)
    print(f"patched {BODY}")


if __name__ == "__main__":
    apply()

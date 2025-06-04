// basic volume GainSlider using mui
import React, { useEffect, useState } from "react";
import { Stack, Slider } from "@mui/material";
import { useQrwc } from "../context/QrwcContext";
import { IControlState } from "@q-sys/qrwc";

function GainSlider() {
  const { gain } = useQrwc();
  const [gainVal, setGainVal] = useState(0);

  useEffect(() => {
    if(!gain) return
    const listener = (state: IControlState) => {
      setGainVal(state.Value ?? 0);
    };
    gain?.on("update", listener);

    return () => {
      gain?.removeListener("update", listener);
    };
  }, [gain]);

  const marks = [
    {
      value: -100,
      label: "-100",
    },
    {
      value: 20,
      label: "20",
    },
  ];

  if(!gain){
    return null
  }

  return (
    <Stack sx={{ height: 300 }} spacing={1} direction="row">
      <Slider
        aria-label="Volume"
        orientation="vertical"
        value={gainVal}
        onChange={(_, newValue) => {
          if (typeof newValue !== "number") return;
          setGainVal(newValue);
          gain?.update(newValue);
        }}
        min={gain?.state.ValueMin ?? 0}
        max={gain?.state.ValueMax ?? 0}
        marks={marks}
      />
    </Stack>
  );
}

export default GainSlider;

// basic volume GainMute using mui
import React, { useEffect, useState } from "react";
import { Stack, Switch, FormControlLabel, Typography } from "@mui/material";
import { useQrwc } from "../context/QrwcContext";
import { IControlState } from "@q-sys/qrwc";

function GainMute() {
  const { mute } = useQrwc();
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const listener = (state: IControlState) => {
      setMuted(state.Bool);
    };
    mute?.on("update", listener);

    return () => {
      mute?.removeListener("update", listener);
    };
  }, [mute]);

  // check if control exists
  if (!mute) {
    return null;
  }

  return (
    <FormControlLabel
      control={
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography>Off</Typography>
          <Switch
            checked={muted}
            onChange={(event) => {
              setMuted(event.target.checked);
              mute?.update(event.target.checked);
            }}
          />
          <Typography>On</Typography>
        </Stack>
      }
      label="Mute"
      labelPlacement="top"
    />
  );
}

export default GainMute;

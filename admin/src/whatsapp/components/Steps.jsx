import Box from "@mui/material/Box";
import { Children } from "react";

/** Numbered steps. Order matters, so a real ordered list is the right structure.
 * Pass each step as its own child: <Steps><>First</><>Second</></Steps>. */
export function Steps({ children }) {
  return (
    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1.5 }}>
      {Children.toArray(children).map((child, i) => (
        <Box component="li" key={i} sx={{ display: "flex", gap: 1.5, typography: "body2", color: "text.secondary" }}>
          <Box
            aria-hidden="true"
            sx={{
              mt: "2px",
              width: 20,
              height: 20,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              bgcolor: "action.selected",
              color: "text.primary",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {i + 1}
          </Box>
          <span>{child}</span>
        </Box>
      ))}
    </Box>
  );
}

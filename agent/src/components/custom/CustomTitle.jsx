import { Divider, Stack, Typography } from "@mui/material";

function CustomTitle({ title, titleVariant, subtitle }) {
  return (
    <>
      <Stack
        direction="row"
        justifyContent="flex-start"
        alignItems="center"
        spacing={1}
        py={2}
      >
        {/* <Box
          sx={{
            display: { xs: 'none', md: 'inline-block' },
          }}
        >
          {icon}
        </Box> */}
        <Stack>
          <Typography variant={titleVariant || "h4"}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Stack>
      </Stack>

      <Divider sx={{mb:4}}/>
    </>
  );
}

export default CustomTitle;

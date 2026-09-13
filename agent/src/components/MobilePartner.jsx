import { MOBILE_PROVIDER } from "../mocks/columns";
import TextField from "@mui/material/TextField";
import Avatar from "@mui/material/Avatar";
import MenuItem from "@mui/material/MenuItem";

function MobilePartner({
  size,
  label,
  value, // Assuming this is an object: { value: 'mtn-gh', label: 'MTN', ... }
  setValue,
  helperText,
  error,
  props,
}) {
  // Extract the string value for MUI, default to empty string if undefined/null
  const stringValue =
    value && typeof value === "object" ? value.value : value || "";

  return (
    <TextField
      label={label || "Mobile Money Partner"}
      size={size || "small"}
      select
      value={stringValue || ""} // Material UI gets the string it expects
      onChange={(e) => {
        const targetValue = e.target.value;
  

        // Find the full object to send back to the parent state
        const selectedObject = MOBILE_PROVIDER.find(
          (p) => p.value === targetValue,
        );

        setValue(selectedObject.value);
      }}
      fullWidth
      error={error}
      helperText={helperText}
      {...props}
    >
      {MOBILE_PROVIDER.map((provider) => (
        <MenuItem
          key={provider.id}
          value={provider.value} // This is a string (e.g., 'mtn-gh')
          sx={{ display: "flex", gap: 2, fontSize: 14 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Avatar
              variant="square"
              alt="network"
              src={provider.image}
              style={{ width: "28px", height: 16, objectFit: "contain" }}
            />
            {provider.label}
          </div>
        </MenuItem>
      ))}
    </TextField>
  );
}

export default MobilePartner;

// function MobilePartner({
//   size,
//   label,
//   value,
//   setValue,
//   helperText,
//   error,
//   props,
// }) {
//   return (
//     <TextField
//       label={label || "Mobile Money Partner"}
//       size={size || "small"}
//       select
//       value={value}
//       onChange={(e) => {
//         setValue(e.target.value);
//       }}
//       fullWidth
//       error={error}
//       helperText={helperText}
//       {...props}
//     >
//       {MOBILE_PROVIDER.map((provider) => (
//         <MenuItem
//           key={provider.id}
//           value={provider.value}
//           sx={{ display: "flex", gap: 2, fontSize: 14 }}
//         >
//           <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
//             <Avatar
//               variant="square"
//               alt="network"
//               src={provider.image}
//               style={{ width: "28px", height: 16, objectFit: "contain" }}
//             />
//             {provider.label}
//           </div>
//         </MenuItem>
//       ))}
//     </TextField>
//   );
// }

// export default MobilePartner;

/* eslint-disable react-refresh/only-export-components */
import {
  Avatar,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
  LinearProgress,
} from "@mui/material";
import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import DOMPurify from "dompurify";
import { currencyFormatter, IMAGES } from "../constants";
import { format } from "date-fns"; // replaced moment
import { ArrowDropDown, Attachment } from "@mui/icons-material";

import _ from "lodash";
import MainDropdown from "../components/dropdowns/MainDropdown";
import { getInitials } from "../config/validation";
import Active from "../components/Active";
import { Link } from "react-router-dom";
import { hidePin } from "../config/hideDetails";


export const ContactInfo = ({ email, phonenumber }) => {
  return (
    <Stack>
      <Typography variant="body2" color="info.main" textTransform="lowercase">
        {email}
      </Typography>
      <Typography variant="body2">{phonenumber}</Typography>
    </Stack>
  );
};

export const PAGES = [
  {
    title: "Waec & SHS Placement Checker",
    category: "Waec Checker",
    note: "Note",
    type: "waec",
    route: "add-waec-checker",
  },
  {
    title: "University & Polytechnic Forms",
    category: "University",
    note: "Note",
    type: "university",
    route: "add-university-forms",
  },
  {
    title: "Security Service Forms",
    category: "Security Service",
    note: "Note",
    type: "security",
    route: "add-security-service",
  },
  {
    title: "Cinema & Event Tickets",
    category: "Cinema Ticket",
    note: "Note",
    type: "cinema",
    route: "add-cinema-tickets",
  },
  {
    title: "Stadium Tickets",
    category: "Stadium Ticket",
    note: "Note",
    type: "stadium",
    route: "add-stadia-tickets",
  },
  {
    title: "Bus Tickets",
    category: "Bus Ticket",
    note: "Note",
    type: "bus",
    route: "add-bus-tickets",
  },
];

export const MATCH_TYPE = [
  "FRIENDLY MATCH",
  "LEAGUE MATCH",
  "LEAGUE CUP",
  "LEAGUE CUP FINAL",
  "CUP FINAL",
  "CHARITY MATCH",
];

export const STADIUM_STANDS = [
  "RED STAND",
  "YELLOW STAND",
  "GREEN STAND",
  "VIP STAND",
  "VVIP STAND",
  "POPULAR STAND",
  "NORTH STAND",
  "SOUTH STAND",
  "EAST STAND",
  "WEST STAND",
];

export const CINEMA_TICKET_TYPE = [
  "REGULAR",
  "VIP",
  "VVIP",
  "STANDARD",
  "PREMIUM",
  "ECONOMY",
  "EXECUTIVE",
  "GOLD",
  "LUXURY",
  "ANNEX",
  "SOFA",
  "GALLERY",
  "BALCONY",
  "CHILD",
  "TEENS",
  "ADULT",
  "FAMILY",
  "STUDENT",
  "SENIOR",
];
export const WAEC_VOUCHER_PRICING = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
];

export const UNIVERSITY_FORM_TYPE = [
  "Undergraduate",
  "Postgraduate",
  "Distance Education",
  "Sandwich",
  "Evening",
  "Diploma",
  "Diploma Top Up",
];

export const SALES_VOUCHERS = [
  {
    title: "WAEC & SHS Placement Checker",
    type: "waec",
  },
  {
    title: "University & Polytechnic Forms",
    type: "university",
  },
  {
    title: "Security Service Forms",
    type: "security",
  },
  {
    title: "Cinema Tickets",
    type: "cinema",
  },
  {
    title: "Stadium Tickets",
    type: "stadium",
  },
  {
    title: "Bus Tickets",
    type: "bus",
  },
];

export const SALES_TICKETS = [
  {
    title: "Cinema Tickets",
    type: "cinema",
  },
  {
    title: "Stadium Tickets",
    type: "stadium",
  },
  {
    title: "Bus Tickets",
    type: "bus",
  },
];

export const checkerColumns = [
  {
    title: "ID",
    field: "id",
  },
  {
    title: "Voucher",
    field: "voucher",
  },
  {
    title: "Total",
    field: "total",
    type: "numeric",
  },
  {
    title: "New",
    field: "new",
    type: "numeric",
  },
  {
    title: "Sold",
    field: "sold",
    type: "numeric",
  },
  {
    title: "Used",
    field: "used",
    type: "numeric",
  },
  {
    title: "Expired",
    field: "expired",
    type: "numeric",
  },
];



export const VOUCHER_COLUMNS = [
  {
    title: "#",
    field: "id",
    hidden: true,
  },
  {
    title: "Status",
    field: "status",
    render: ({ status }) => (
      <Chip
        variant="filled"
        color={
          status === "new" ? "success" : status === "sold" ? "info" : "error"
        }
        size="small"
        label={_.capitalize(status)}
        sx={{ color: "white" }}
      />
    ),
  },
  {
    title: "Voucher",
    field: "voucher",
  },
  {
    title: "Pin",
    field: "pin",
    render: ({ pin }) => hidePin(pin),
  },
  {
    title: "Serial",
    field: "serial",
    render: ({ serial }) => hidePin(serial),
  },
];

export const TICKETS_COLUMNS = [
  {
    title: "#",
    field: "id",
    hidden: true,
  },
  {
    title: "Status",
    field: "status",
    render: ({ status }) => (
      <Chip
        variant="filled"
        color={
          status === "new"
            ? "success"
            : status === "sold"
              ? "info"
              : status === "used"
                ? "error"
                : "warning"
        }
        size="small"
        label={_.capitalize(status)}
        sx={{ color: "white" }}
      />
    ),
  },
  {
    title: "Voucher",
    field: "voucher",
  },
  {
    title: "Pin/Serial",
    field: "pin",
    render: ({ pin }) => hidePin(pin),
  },
  {
    title: "Type/Seat No.",

    render: ({ category, details }) => {
      return category === "bus"
        ? details?.seatNo
        : ["stadium", "cinema"].includes(category)
          ? details?.type
          : null;
    },
  },
];
export const waecCategoryColumns = [
  {
    title: "#",
    field: "id",
    hidden: true,
  },
  {
    title: "Logo",
    field: "logo",
    render: ({ logo }) => {
      return (
        <img
          src={logo}
          width="48px"
          height="48px"
          style={{
            maxWidth: "100%",
            objectFit: "contain",
            aspectRatio: "1/1",
          }}
        />
      );
    },
  },
  {
    title: "Voucher",
    field: "voucherType",
  },

  {
    title: "Category",
    field: "category",
    hidden: true,
  },
  {
    title: "Selling Price",
    field: "price",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
    cellStyle: {
      color: "green",
    },
  },
  {
    field: "pricing",
    title: "Pricing",
    textAlign: "center",
    render: ({ pricing }) => (
      <Button
        variant="text"
        className="dropdown-trigger"
        sx={{
          position: "relative",
          borderRadius: 1.2,
        }}
        endIcon={<ArrowDropDown />}
      >
        Pricing
        {pricing?.length > 0 && (
          <MainDropdown>
            <List sx={{ minWidth: 200, maxHeight: 200, overflow: "auto" }}>
              {pricing?.length !== 0
                ? pricing?.map((item) => (
                    <ListItem key={item.id}>
                      <ListItemText
                        primary={`${
                          item.type
                        } checker(s) for ${currencyFormatter(item?.price)}`}
                        primaryTypographyProps={{
                          fontSize: 11,
                          color: "primary.main",
                          fontWeight: "bolder",
                        }}
                      />
                    </ListItem>
                  ))
                : null}
            </List>
          </MainDropdown>
        )}
      </Button>
    ),
  },
];

export const universityCategoryColumns = [
  {
    title: "#",
    field: "id",
    hidden: true,
  },
  {
    title: "Logo",
    field: "logo",
    render: ({ logo }) => {
      return (
        <img
          src={logo || null}
          width="48px"
          height="48px"
          style={{
            maxWidth: "80%",
            objectFit: "contain",
            aspectRatio: "1/1",
          }}
        />
      );
    },
  },
  {
    title: "University ",
    field: "voucherType",
    cellStyle:{
      textTransform:'capitalize'
    }
  },
  {
    title: "Form Type",
    field: "formType",
    // hidden: true,
  },
  {
    title: "Category",
    field: "category",
       cellStyle:{
      textTransform:'capitalize'
    }
  },
  {
    title: "Price",
    field: "price",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
    cellStyle: {
      color: "green",
      fontWeight:'bold'
    },
  },
];
export const voucherCategoryColumns = [
  {
    title: "#",
    field: "id",
    hidden: true,
  },
  {
    title: "Logo",
    field: "logo",
    render: ({ logo }) => {
      return (
            <img
          src={logo || null}
          width="48px"
          height="48px"
          style={{
            maxWidth: "80%",
            objectFit: "contain",
            aspectRatio: "1/1",
          }}
          />
      );
    },
  },
  {
    title: "Voucher",
    field: "voucherType",
  },
  {
    title: "Category",
    field: "category",
    cellStyle:{
      textTransform:'capitalize'
    }
  },
  {
    title: "Price",
    field: "price",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
    cellStyle: {
      color: "green",
    },
  },
];

export const busTicketColumns = [
  {
    field: "id",
    title: "ID",
    hidden: true,
  },
  {
    field: "companyName",
    title: "Company",
  },
  {
    title: "Logo",
    field: "logo",
    render: ({ logo }) => {
      return (
        <img
          src={logo || null}
          width="48px"
          height="48px"
          style={{
            maxWidth: "50%",
            objectFit: "contain",
            aspectRatio: "1/1",
          }}
        />
      );
    },
  },
  {
    field: "journey",
    title: "Route",
    cellStyle: {
      color: "#f78e2a",
      textTransform: "uppercase",
    },
  },
  {
    title: "Seats",
    field: "noOfSeats",
    type: "numeric",
    cellStyle:{
      textTransform:'capitalize'
    }
  },
  {
    title: "Vec.No.",
    field: "vehicleNo",

  },
  {
    field: "date",
    title: "Date/Time",
    searchable: true,
    customFilterAndSearch: (data, rowData) => {
      const date = format(new Date(rowData.date), "EEEE, MMMM d, yyyy");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
    render: (rowData) => (
      <ListItemText
        primary={format(new Date(rowData.date), "EEEE, MMMM d, yyyy")}
        secondary={format(new Date(rowData.time), "h:mm a")}
        primaryTypographyProps={{ fontSize:14 }}
        secondaryTypographyProps={{ color: "text.secondary" ,fontSize:14}}
      />
    ),
  },
  {
    field: "price",
    title: "Fare",
    searchable: true,
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
    cellStyle: {
      color: "green",
        fontWeight:'bold'
    },

    // customFilterAndSearch: (data, rowData) => {
    //   const price = currencyFormatter(rowData.price);
    //   return price.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    // },
    // render: (rowData) => currencyFormatter(rowData.price),
  },
];
export const cinemaTicketColumns = [
  {
    field: "id",
    title: "ID",
    hidden: true,
  },
  {
    field: "companyName",
    title: "Company",
  },
  {
    field: null,
    title: "Movie/Event",
    cellStyle: {
      textAlign: "left",
    },
    customFilterAndSearch: (data, rowData) => {
      return rowData?.movie.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
    render: (rowData) => {
      return (
        <Stack
          // direction="row"
          rowGap={1}
          justifyContent="flex-start"
          alignItems="flex-start"
        >
          <Avatar
            variant="square"
            src={rowData?.details?.cinema}
            sx={{ width: 48, height: 48 }}
          />
          <Typography
          variant="body2"
            sx={{
              whiteSpace: "nowrap",
              fontWeight: "bold",
              textTransform: "uppercase",
            }}
          >
            {rowData.movie}
          </Typography>
        </Stack>
      );
    },
  },
  {
    field: "theatre",
    title: "Theatre",
    render: (rowData) => (
      <ListItemText
        primary={rowData?.theatre}
        secondary={rowData?.location}
        primaryTypographyProps={{ fontSize:14 }}
        secondaryTypographyProps={{ color: "text.secondary" ,fontSize:14}}
      />
    ),
  },
  {
    field: "date",
    title: "Date/Time",
    customFilterAndSearch: (data, rowData) => {
      const date = format(new Date(rowData.date), "EEEE, MMMM d, yyyy");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
    render: (rowData) => (
      <ListItemText
        primary={format(new Date(rowData.date), "EEEE, MMMM d, yyyy")}
        secondary={format(new Date(rowData.time), "h:mm a")}
        primaryTypographyProps={{ fontSize:14 }}
        secondaryTypographyProps={{ color: "text.secondary" ,fontSize:14}}
      />
    ),
  },
  {
    field: "pricing",
    title: "Pricing",
    textAlign: "center",
    render: ({ pricing }) => (
      <Button
        variant="text"
        // size="small"
        className="dropdown-trigger"
        sx={{
          position: "relative",
        }}
        endIcon={<ArrowDropDown />}
      >
        Pricing
        <MainDropdown>
          <List>
            {pricing?.length !== 0
              ? pricing?.map((item) => (
                  <ListItem key={item.id}>
                    <ListItemText
                      primary={`${item.type} (${item.quantity})`}
                      primaryTypographyProps={{
                        fontSize: 12,
                        color: "primary.main",
                        fontWeight: "bolder",
                      }}
                      secondary={currencyFormatter(item?.price)}
                      secondaryTypographyProps={{
                        fontSize: 12,
                      }}
                    />
                  </ListItem>
                ))
              : null}
          </List>
        </MainDropdown>
      </Button>
    ),
  },
];
export const stadiumTicketColumns = [
  {
    field: "id",
    title: "ID",
    hidden: true,
  },
  {
    field: "companyName",
    title: "Company",
  },
  {
    field: null,
    title: "Match",
    searchable: true,
    width: 300,
    customFilterAndSearch: (data, rowData) => {
      return rowData?.match.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
    render: (rowData) => {
      return (
        <Stack rowGap={1} justifyContent="center" alignItems="center">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="center"
            px={4}
            // gap={3}
          >
            <img
              src={rowData?.details?.homeImage}
              width="48px"
              height="48px"
              style={{
                // maxWidth: "100%",
                objectFit: "contain",
                aspectRatio: "1/1",
              }}
            />
            <Typography>VS</Typography>
            <img
              src={rowData?.details?.awayImage}
              width="48px"
              height="48px"
              style={{
                // maxWidth: "80%",
                objectFit: "contain",
                aspectRatio: "1/1",
              }}
            />
          </Stack>
          <Typography
            sx={{
              whiteSpace: "wrap",
              fontSize: 12,
              fontWeight: "bold",
              textTransform: "uppercase",
              textAlign: "center",
            }}
            color="secondary.main"
          >
            ({rowData.matchType})
          </Typography>
          <Typography
            sx={{
              whiteSpace: "wrap",
              fontSize: 14,
              fontWeight: "bold",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            {rowData.match}
          </Typography>
        </Stack>
      );
    },
  },
  {
    field: "matchType",
    title: "Type",
    hidden: true,
  },

  {
    field: "venue",
    title: "Venue",
  },
  {
    field: "date",
    title: "Date/Time",
    searchable: true,
    cellStyle: {
      fontSize: 10,
    },
    customFilterAndSearch: (data, rowData) => {
      const date = format(new Date(rowData.date), "EEEE, MMMM d, yyyy");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
    render: (rowData) => (
      <ListItemText
        primary={format(new Date(rowData.date), "EEEE, MMMM d, yyyy")}
        secondary={format(new Date(rowData.time), "h:mm a")}
        primaryTypographyProps={{ fontSize:14 }}
        secondaryTypographyProps={{ color: "text.secondary" ,fontSize:14}}
      />
    ),
  },
  {
    field: "stand",
    title: "Stands",
    textAlign: "center",
    render: ({ pricing }) => (
      <Button
        variant="text"
        className="dropdown-trigger"
        sx={{
          position: "relative",
        }}
        endIcon={<ArrowDropDown className="main-dropdown-arrow" />}
      >
        Pricing
        <MainDropdown>
          <List>
            {pricing?.length !== 0
              ? pricing?.map((item) => (
                  <ListItem key={item.id}>
                    <ListItemText
                      primary={`${item.type} (${item.quantity})`}
                      primaryTypographyProps={{
                        fontSize: 10,
                        color: "primary.main",
                        fontWeight: "bolder",
                      }}
                      secondary={currencyFormatter(item?.price)}
                      secondaryTypographyProps={{
                        fontSize: 10,
                      }}
                    />
                  </ListItem>
                ))
              : null}
          </List>
        </MainDropdown>
      </Button>
    ),
  },
];

export const ROLE_LIST = ["Administrator", "Employee"];

export const CATEGORY_LIST = [
  { id: "waec", name: "WAEC Checkers & SHS Placement" },
  {
    id: "university",
    name: "University  Vouchers",
  },
  {
    id: "security",
    name: "Security Service Vouchers",
  },
  {
    id: "bus",
    name: "Bus Tickets",
  },
  {
    id: "stadium",
    name: "Stadium Tickets",
  },
  {
    id: "cinema",
    name: "Cinema Tickets",
  },
];

export const USERS_COLUMNS = [
  {
    title: "id",
    field: "id",
    hidden: true,
  },

  {
    title: "Name",
    field: "name",
    hidden: true,
    export: true,
  },

  {
    title: "User",
    field: "",
    render: ({ name, profile }) => {
      return (
        <Stack
          // direction="row"
          justifyContent="flex-start"
          alignItems="center"
          spacing={1}
        >
          <Avatar
            alt="profile"
            src={profile}
            sx={{
              width: 48,
              height: 48,
              bgcolor: "primary.main",
              cursor: "pointer",
            }}
          >
            {getInitials(`${name}`)}
          </Avatar>
          <Typography
            color="primary.main"
            textTransform="uppercase"
            whiteSpace="nowrap"
            variant="body2"
          >
            {name}
          </Typography>
        </Stack>
      );
    },
    customFilterAndSearch: (data, { name }) => {
      return name.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
  },
  {
    title: "National ID",
    field: "nid",
    export: true,
    hidden: true,
  },

  {
    title: "DAte of Birth",
    field: "dobb",
    export: true,
    hidden: true,
  },
  {
    title: "DOB",
    field: "dob",
    export: false,
    hidden: true,
  },

  {
    title: "Contact Info.",
    field: null,
    searchable: true,
    customFilterAndSearch: (data, { email, phonenumber }) => {
      return (
        email?.toLowerCase().lastIndexOf(data.toLowerCase()) > -1 ||
        phonenumber.toLowerCase().lastIndexOf(data.toLowerCase()) > -1
      );
    },
    render: ({ email, phonenumber }) => (
      <ContactInfo email={email} phonenumber={phonenumber} />
    ),
  },
  {
    field: "active",
    title: "Status",
    export: false,
    render: ({ active }) => <Active active={active} />,
  },
  {
    title: "Created ON",
    field: "createdAt",
    render: ({ createdAt }) =>
      createdAt ? format(new Date(createdAt), "PPP p") : "N/A",
    customFilterAndSearch: (data, { createdAt }) => {
      if (!createdAt) return false;
      const formatted = format(new Date(createdAt), "PPP p");
      return formatted.toLowerCase().includes(data.toLowerCase());
    },
  },
  {
    title: "Email Address",
    field: "email",
    hidden: true,
    export: true,
  },
  {
    title: "Telephone No.",
    field: "phonenumber",
    hidden: true,
    export: true,
  },
];
export const EMPLOYEES_COLUMNS = [
  {
    title: "id",
    field: "id",
    hidden: true,
  },

  {
    title: "Firstname",
    field: "firstname",
    hidden: true,
  },
  {
    title: "Lastname",
    field: "lastname",
    hidden: true,
  },
  {
    title: "Username",
    field: "username",
    hidden: true,
    export: true,
  },

  {
    title: "Employee",
    field: "",
    render: ({ name, profile, username, firstname, lastname }) => {
      // Determine the display name (fallback: first + last, or username)
      const displayName =
        name || `${firstname || ""} ${lastname || ""}`.trim() || username;

      return (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Avatar
            alt={displayName}
            src={profile}
            sx={{
              width: 40,
              height: 40,
              bgcolor: "primary.main",
              fontSize: "0.875rem",
            }}
          >
            {getInitials(displayName)}
          </Avatar>
          <Stack>
            <Typography variant="body2" fontWeight="medium">
              {displayName}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              fontSize="0.75rem"
            >
              @{username}
            </Typography>
          </Stack>
        </Stack>
      );
    },
    customFilterAndSearch: (data, { name, username, firstname, lastname }) => {
      const fullName = name || `${firstname || ""} ${lastname || ""}`.trim();
      return (
        fullName.toLowerCase().lastIndexOf(data.toLowerCase()) > -1 ||
        username.toLowerCase().lastIndexOf(data.toLowerCase()) > -1
      );
    },
  },
  {
    title: "Contact Info.",
    field: null,
    searchable: true,
    customFilterAndSearch: (data, { email, phonenumber }) => {
      return (
        email?.toLowerCase().lastIndexOf(data.toLowerCase()) > -1 ||
        phonenumber.toLowerCase().lastIndexOf(data.toLowerCase()) > -1
      );
    },
    render: ({ email, phonenumber }) => (
      <ContactInfo email={email} phonenumber={phonenumber} />
    ),
  },
  {
    title: "Role",
    field: "role_name",
  },
  {
    field: "active",
    title: "Status",
    export: false,
    render: ({ active }) => <Active active={active} />,
  },

  {
    title: "Email Address",
    field: "email",
    hidden: true,
    export: true,
  },
  {
    title: "Telephone No.",
    field: "phonenumber",
    hidden: true,
    export: true,
  },
];
export const AGENTS_COLUMNS = [
  {
    title: "id",
    field: "id",
    hidden: true,
  },

  {
    title: "Firstname",
    field: "firstname",
    hidden: true,
  },
  {
    title: "Lastname",
    field: "lastname",
    hidden: true,
  },

  {
    title: "Agent/Distributor",
    field: "",
    render: ({ name, username, profile }) => {
      return (
        <Stack
          direction="row"
          justifyContent="flex-start"
          alignItems="center"
          spacing={1}
        >
          <Avatar
            alt="profile"
            src={profile}
            sx={{
              width: 48,
              height: 48,
              bgcolor: "primary.main",
              cursor: "pointer",
            }}
          >
            {getInitials(`${name}`)}
          </Avatar>
          <Stack>
            <Typography
              textTransform="uppercase"
              whiteSpace="nowrap"
              variant="body2"
            >
              {`${name}`}
            </Typography>
            <Typography color="info.main" whiteSpace="nowrap" variant="body2">
              {`${username}`}
            </Typography>
          </Stack>
        </Stack>
      );
    },
    customFilterAndSearch: (data, { firstname, lastname }) => {
      return (
        firstname.toLowerCase().lastIndexOf(data.toLowerCase()) > -1 ||
        lastname.toLowerCase().lastIndexOf(data.toLowerCase()) > -1
      );
    },
  },

  {
    title: "Contact Info.",
    field: null,
    searchable: true,
    customFilterAndSearch: (data, { email, phonenumber }) => {
      return (
        email?.toLowerCase().lastIndexOf(data.toLowerCase()) > -1 ||
        phonenumber.toLowerCase().lastIndexOf(data.toLowerCase()) > -1
      );
    },
    render: ({ email, phonenumber }) => (
      <ContactInfo email={email} phonenumber={phonenumber} />
    ),
  },
  {
    field: "active",
    title: "Status",
    export: false,
    render: ({ active }) => <Active active={active} />,
  },

  {
    title: "Email Address",
    field: "email",
    hidden: true,
    export: true,
  },
  {
    title: "Telephone No.",
    field: "phonenumber",
    hidden: true,
    export: true,
  },

  // {
  //   field: '',
  //   title: 'Action',
  //   export: false,
  //   width: 40,
  //   render: (rowData) => <EmployeeMenu rowData={rowData} />,
  // },
];

export const BROADCAST_MESSAGES_COLUMNS = [
  {
    title: "ID",
    field: "id",
    hidden: true,
  },
  {
    field: "createdAt",
    title: "Date of Issue",
    render: (rowData) => {
      const date = new Date(rowData?.createdAt).toDateString();
      const time = new Date(rowData?.createdAt).toLocaleTimeString();
      return (
        <ListItemText
          primary={date}
          primaryTypographyProps={{
            fontSize: 13,
            color: "primary.main",
          }}
          secondary={time}
          secondaryTypographyProps={{
            fontSize: 11,
          }}
        />
      );
    },
  },
  {
    title: "Status",
    field: "isDelivered",
    export: false,
    render: ({ isDelivered }) => (
      <Active
        active={isDelivered}
        activeMsg="Delivered"
        inActiveMsg="Not Delivered"
      />
    ),
  },
  {
    title: "Recipient",
    field: "recipient",
  },

  {
    field: "type",
    title: "Type",
    export: true,
    render: ({ type }) => (
      <Chip
        label={type === "Email" ? "Email" : "SMS"}
        color={type === "Email" ? "primary" : "secondary"}
        size="small"
      />
    ),
  },

  {
    title: "Message",
    field: "body",
    render: (rowData) => {
      return (
        <>
          {rowData?.type === "SMS" ? (
            <ListItemText
              primary={rowData?.title}
              primaryTypographyProps={{
                fontSize: 13,
                color: "primary.main",
                fontWeight: "700",
              }}
              secondary={rowData?.message}
              secondaryTypographyProps={{
                width: "50ch",
              }}
            />
          ) : (
            <div>
              <Typography
                sx={{
                  fontSize: 13,
                  color: "primary.main",
                  fontWeight: "700",
                }}
              >
                {rowData?.title}
              </Typography>
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(rowData?.body),
                }}
                style={{ width: "30ch" }}
              ></div>
            </div>
          )}
        </>
      );
    },
  },
];

export const recentTransactionColumns = [
  {
    title: "ID",
    field: "_id",
    hidden: true,
  },
  {
    title: "Date",
    field: "date",
    render: (rowData) => (
      <ListItemText
        primary={format(new Date(rowData.createdAt), "do MMM, yyyy")}
        secondary={format(new Date(rowData.createdAt), "h:mm a")}
        primaryTypographyProps={{
          color: "primary.main",
          fontSize: 14,
        }}
        secondaryTypographyProps={{
          color: "info.main",
          fontSize: 14,
        }}
      />
    ),
  },
  {
    title: "Personal Info",
    field: "quantity",
    render: (rowData) => (
      <ListItemText
        primary={rowData?.email}
        secondary={rowData?.phonenumber}
        primaryTypographyProps={{
          color: "info.main",
          fontSize: 14,
        }}
        secondaryTypographyProps={{
          color: "primary.main",
          fontSize: 14,
        }}
      />
    ),
  },
  {
    title: "Type",
    field: "domain",
  },
  {
    title: "Amount",
    field: "amount",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
    cellStyle: {
      color: "green",
    },
  },
  {
    title: "Issuer",
    field: "issuer",
  },
];

export const topCustomersColumns = [
  {
    title: "Telephone Number",
    field: "phonenumber",
  },
  {
    title: "Amount",
    field: "amount",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  },
];

export const topSoldColumns = [
  {
    title: "Type",
    field: null,
    render: ({ type, count }) => {
      return (
        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={2}
            justifyContent="space-between"
            alignItems="center"
          >
            <span>{type}</span>
            <span style={{ fontWeight: "bold", color: "var(--secondary)" }}>
              {count}
            </span>
          </Stack>
          <LinearProgress variant="determinate" value={count} />
        </Stack>
      );
    },
  },
];

export const transactionsColumns = (type, refund) => [
  {
    title: "Date",
    field: "updatedAt",
    // width: "30%",
    render: ({ createdAt }) =>
      format(new Date(createdAt), "MMMM d, yyyy h:mm a"),
    searchable: true,
    customFilterAndSearch: (data, rowData) => {
      const date = format(new Date(rowData.createdAt), "MMMM d, yyyy h:mm a");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
  },
  {
    title: "Status",
    field: "status",
    customFilterAndSearch: (data, { status }) => {
      return status?.toLowerCase().lastIndexOf(data?.toLowerCase()) > -1;
    },
    render: ({ service, status, isProcessed }) =>
      service === "airtime" ? (
        <Button
          size="small"
          label={
            status === "completed" && Boolean(isProcessed)
              ? "Completed"
              : status === "refunded" && Boolean(isProcessed)
                ? "Refunded"
                : "Pending"
          }
          sx={{
            color: "#fff",
            bgcolor:
              status === "completed" && Boolean(isProcessed)
                ? "success.darker"
                : status === "refunded" && Boolean(isProcessed)
                  ? "secondary.darker"
                  : "warning.darker",
            borderRadius: 1,
          }}
        >
          {status === "completed" && Boolean(isProcessed)
            ? "Completed"
            : status === "refunded" && Boolean(isProcessed)
              ? "Refunded"
              : "Pending"}
        </Button>
      ) : (
        <StatusChip status={status} />
      ),
  },
  {
    title: "Id",
    field: "id",
  },
  {
    title: "Ext. Trans. ID",
    field: "externalTransactionId",
    // cellStyle: {
    //   width: 100,
    // },
  },
  {
    title: "Payment Reference ID",
    field: "reference",
    // width: "30%",
    hidden: true,
    cellStyle: {
      width: 100,
    },
  },
  {
    title: "Kind",
    field: "kind",
    // hidden: !["All", "airtime"].includes(type),
    hidden: true,
  },
  {
    title: "Service",
    field: "service",
    render: ({ service }) => _.capitalize(service),
  },
  {
    title: "Link",
    field: "downloadLink",
    hidden: true,
  },
  {
    title: type || "Recipient",
    field: "voucherType",
    render: (row) =>
      row?.service === "airtime" ? (
        row?.kind === "bulk" ? (
          <Stack>
            {JSON.parse(row?.recipient)?.map((item) => (
              <small key={item?.recipient}>
                {item?.recipient}{" "}
                <b style={{ color: "var(--secondary)" }}>
                  ({currencyFormatter(item?.price)})
                </b>
              </small>
            ))}
          </Stack>
        ) : (
          row?.recipient
        )
      ) : (
        row?.voucherType || row?.meter || row?.kind
      ),
  },

  {
    title: "Category",
    field: "type",
    hidden: true,
  },

  {
    title: "Email",
    field: "email",
    hidden: true,
  },
  {
    title: "Telephone Number",
    field: "phonenumber",
    hidden: true,
    export: true,
  },

  {
    title: "Contact Info.",
    field: "email",
    hidden: true,
    searchable: true,
    customFilterAndSearch: (data, { email, phonenumber }) => {
      return (
        email?.toLowerCase().lastIndexOf(data?.toLowerCase()) > -1 ||
        phonenumber?.toLowerCase().lastIndexOf(data?.toLowerCase()) > -1
      );
    },
    render: ({ email, phonenumber }) => (
      <ContactInfo email={email} phonenumber={phonenumber} />
    ),
  },
  {
    title: "Payment Method",
    field: "mode",
    hidden: true,
  },

  {
    title: "Amount",
    field: "amount",
    type: "currency",
    align: "center",
    cellStyle: {
      textAlign: "center",
    },
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  },
  {
    title: "Issuer ID",
    field: "issuer",
    // hidden: !["All", "prepaid", "airtime"].includes(type),
    hidden: true,
    customFilterAndSearch: (data, { issuer }) => {
      return issuer?.toLowerCase().lastIndexOf(data?.toLowerCase()) > -1;
    },
  },
  {
    title: "Completed By",
    field: "issuerName",
    // hidden: !["All", "prepaid", "airtime"].includes(type),
    hidden: true,
    customFilterAndSearch: (data, { issuerName }) => {
      return issuerName?.toLowerCase().lastIndexOf(data?.toLowerCase()) > -1;
    },
  },
  {
    title: "Refunded By",
    field: "refunder",
    // hidden: !refund,
    hidden: true,
  },
];

export const bulkAirtimeTransactionsColumns = [
  {
    title: "Modified on",
    field: "updatedAt",
    render: ({ updatedAt }) =>
      format(new Date(updatedAt), "MMMM d, yyyy h:mm a"),
    searchable: true,
    customFilterAndSearch: (data, rowData) => {
      const date = format(new Date(rowData.updatedAt), "MMMM d, yyyy h:mm a");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
  },
  {
    title: "UpdatedAt",
    field: "updatedAt",
    hidden: true,
  },
  {
    title: "Id",
    field: "id",
    // hidden: true,
  },
  {
    title: "Payment ID",
    field: "paymentId",
    hidden: true,
  },
  {
    title: "ORDER ID",
    field: "orderId",
    hidden: true,
  },
  {
    title: "Status",
    field: "status",
    render: ({ status }) => <StatusChip status={status} />,
  },
  {
    title: "Processing Status",
    field: "processingStatus",
    render: ({ processingStatus }) => <StatusChip status={processingStatus} />,
  },

  {
    title: "Recipient",
    field: "recipient",
    render: (row) => (
      <Stack>
        {row?.recipient.map((item) => (
          <small key={item?.recipient}>
            {item?.recipient}{" "}
            <b style={{ color: "var(--secondary)" }}>
              ({currencyFormatter(item?.price)})
            </b>
          </small>
        ))}
      </Stack>
    ),
  },
  {
    title: "Email",
    field: "email",
    hidden: true,
  },
  {
    title: "Telephone Number",
    field: "phonenumber",
    hidden: true,
  },
  {
    title: "Contact Info.",
    field: null,
    searchable: true,
    export: false,
    customFilterAndSearch: (data, { email, phonenumber }) => {
      return (
        email?.toLowerCase().lastIndexOf(data.toLowerCase()) > -1 ||
        phonenumber.toLowerCase().lastIndexOf(data.toLowerCase()) > -1
      );
    },
    render: ({ email, phonenumber }) => (
      <ContactInfo email={email} phonenumber={phonenumber} />
    ),
  },
  {
    title: "Amount",
    field: "amount",
    type: "currency",
    align: "center",
    cellStyle: {
      textAlign: "center",
    },
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  },
];
export const USERS_WALLET = (type) => [
  {
    title: "ID",
    field: "id",
    hidden: true,
    export: true,
  },
  {
    title: "Name",
    field: "name",
    render: ({ userId, name }) => {
      return (
        <Link
          style={{
            textTransform: "uppercase",
            color:'#1897FF'
          }}
          to={type === "users" ? `/users/details/${userId}` : `/agents/${userId}`}
        >
          {name}
        </Link>
      );
    },
  },
  {
    title: "Email Address",
    field: "email",
    hidden: true,
    export: true,
  },
  {
    title: "Telephone No.",
    field: "phonenumber",
    hidden: true,
    export: true,
  },
  {
    title: "Contact Info.",
    field: null,
    searchable: true,
    customFilterAndSearch: (data, { email, phonenumber }) => {
      return (
        email?.toLowerCase().lastIndexOf(data.toLowerCase()) > -1 ||
        phonenumber.toLowerCase().lastIndexOf(data.toLowerCase()) > -1
      );
    },
    render: ({ email, phonenumber }) => (
      <ContactInfo email={email} phonenumber={phonenumber} />
    ),
  },
  {
    title: "CURRENT BALANCE",
    field: "amount",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    },
    cellStyle: {
      color: "green",
    },
  },
  {
    title: "LAST DATE MODIFIED",
    field: "updatedAt",
    export: true,
  },
];
export const AGENT_TRANSACTIONS = [
  {
    title: "TRANSACTION ID",
    field: "id",
    export: true,
  },
  {
    title: "DATE",
    field: "createdAt",
    export: true,
    render: (rowData) => (
      <ListItemText
        primary={format(new Date(rowData.createdAt), "do MMM, yyyy")}
        secondary={format(new Date(rowData.createdAt), "h:mm a")}
        primaryTypographyProps={{
          color: "primary.main",
          fontSize:12
        }}
        secondaryTypographyProps={{
          color: "info.main",
          fontSize:12
        }}
      />
    ),
  },
  {
    title: "Status",
    field: "status",
    render: ({ status }) => <StatusChip status={status} />,
  },
  {
    title: "TYPE",
    field: "type",
    cellStyle: {
      textTransform: "capitalize",
    },
  },
  // {
  //   title: "Recipient",
  //   field: "recipient",
  //   render: (row) => (
  //     <Stack>
  //       {row?.recipient.map((item) => (
  //         <small key={item?.recipient}>
  //           {item?.recipient}{" "}
  //           <b style={{ color: "var(--secondary)" }}>
  //             ({currencyFormatter(item?.price)})
  //           </b>
  //         </small>
  //       ))}
  //     </Stack>
  //   ),
  // },

  {
    title: "Recipient",
    field: "recipient",
  },
  {
    title: "AMOUNT",
    field: "totalAmount",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    },
    cellStyle: {
      color: "green",
    },
  },
  {
    title: "COMMISSION",
    field: "commission",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    },
    cellStyle: {
      color: "blue",
    },
  },
  // {
  //   title: "TOTAL",
  //   field: "totalAmount",
  //   type: "currency",
  //   currencySetting: {
  //     currencyCode: "GHS",
  //     minimumFractionDigits: 2,
  //     maximumFractionDigits: 2,
  //   },
  //   cellStyle: {
  //     color: "black",
  //   },
  // },
];
export const WALLET_TOPUP_TRANSACTIONS = [
  {
    title: "DATE",
    field: "createdAt",
    export: true,
    render: (rowData) => (
      <ListItemText
        primary={format(new Date(rowData.createdAt), "do MMM, yyyy")}
        secondary={format(new Date(rowData.createdAt), "h:mm a")}
        primaryTypographyProps={{
          color: "primary.main",
        }}
        secondaryTypographyProps={{
          color: "info.main",
        }}
      />
    ),
  },
  {
    title: "Status",
    field: "status",
    render: ({ status }) => <StatusChip status={status} />,
  },
  {
    title: "TRANSACTION ID",
    field: "id",
    export: true,
  },
  {
    title: "TYPE",
    field: "type",
    cellStyle: {
      textTransform: "capitalize",
    },
  },
  {
    title: "AMOUNT",
    field: "amount",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
    cellStyle: {
      color: "green",
    },
  },
  { title: "Comment", field: "comment" },
  {
    title: "Details",
    export: false,
    render: (data) => {
      const cre = ["deposit", "credit", "refund"];
      return (
        <ListItemText
          primary={currencyFormatter(data?.wallet)}
          secondary={`${cre.includes(data?.type) ? "+" : "-"} ${data?.amount}`}
          secondaryTypographyProps={{
            color: cre.includes(data?.type) ? "success.darker" : "error.darker",
            fontWeight: "700",
          }}
        />
      );
    },
  },
  // { title: "Issued By", field: "issuerName" },
];
export const SERVICE_PROVIDER = [
  {
    id: "612db3be-2210-41fc-91d1-06573271df49",
    image: IMAGES.mtn,
    label: "MTN",
    value: "MTN",
  },

  {
    id: "7827eb37-6b8c-40da-9503-8f3fc75a0daf",
    label: "Telecel",
    value: "Vodafone",
    image: IMAGES.vodafone,
  },
  {
    id: "915f26e2-e329-4f8c-9378-92cd90b0b4a2",
    label: "AirtelTigo",
    value: "AirtelTigo",
    image: IMAGES.airtel,
  },
];

export const WALLET_TRANSACTIONS = (type) => [

  {
    title: "Last Modified",
    field: "createdAt",
    render: ({ createdAt }) =>
      createdAt ? format(new Date(createdAt), "PPP p") : "N/A",
    customFilterAndSearch: (data, { createdAt }) => {
      if (!createdAt) return false;
      const formatted = format(new Date(createdAt), "PPP p");
      return formatted.toLowerCase().includes(data.toLowerCase());
    },
  },
    {
    title: "TRANSACTION ID",
    field: "id",
    export: true,
  },
  {
    title: "STATUS",
    field: "status",
    render: ({ status }) => <StatusChip status={status} />,
  },
 
  {
    title: "User",
    field: "name",
    render: ({ userId, name }) => {
      return (
        <Link
          // style={{ textDecoration: "underline" }}
          to={`/${type === "users" ? "users" : "airtime/agent"}/details/${
            userId
          }`}
        >
          {name}
        </Link>
      );
    },
  },
  {
    title: "AMOUNT",
    field: "amount",
    type: "currency",
    cellStyle: { fontWeight: 700 },
    render: ({ amount, type }) => {
      const isCredit = type === "credit";
      return (
        <Typography
          component="span"
          sx={{
            fontWeight: 700,
            fontSize: 13,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            color: isCredit ? "success.main" : "error.main",
          }}
        >
          {isCredit ? "+" : "-"} {currencyFormatter(Number(amount || 0))}
        </Typography>
      );
    },
  },
  {
    title: "Type",
    field: "type",
    render: ({ type }) => {
      const isCredit = type === "credit";
      const TypeIcon = isCredit ? ArrowDownward : ArrowUpward;
      return (
        <Chip
          size="small"
          color={isCredit ? "success" : "error"}
          icon={<TypeIcon sx={{ fontSize: 15 }} />}
          label={type ?? "N/A"}
          sx={{
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: 0.5,
            textTransform: "capitalize",
          }}
        />
      );
    },
  },
  { title: "Comment", field: "comment" },
  // {
  //   title: "Attachment",
  //   field: "attachment",
  //   export: false,
  //   render: (rowData) => {
  //     return rowData?.attachment ? (
  //       <Button
  //         LinkComponent="a"
  //         target="_blank"
  //         href={rowData?.attachment}
  //         endIcon={<Attachment color="secondary" />}
  //       >
  //         View File
  //       </Button>
  //     ) : (
  //       "N/A"
  //     );
  //   },
  // },

];

export const EMPLOYEES_ROLES = [
  {
    title: "Vouchers & Tickets",
  },
  {
    title: "Pins & Serials",
    roles: [
      { title: "Generate Pins & Serials" },
      { title: "Export Pins & Serials" },
      { title: "Load checkers pins & serials" },
      { title: "Delete checkers pins & serials" },
      { title: "Export checkers pins & serials" },
    ],
  },
  {
    title: "WAEC Checkers",
    roles: [
      { title: "Create new checkers" },
      { title: "Edit checkers" },
      { title: "Delete checkers" },
      { title: "Export checkers" },
    ],
  },
  {
    title: "University & Polytechnic Forms",
    roles: [
      { title: "Create new forms" },
      { title: "Edit forms" },
      { title: "Delete forms" },
      { title: "Export forms" },
      { title: "Load forms pins & serials" },
      { title: "Delete forms pins & serials" },
      { title: "Export forms pins & serials" },
    ],
  },
  {
    title: "Security Service Forms",
    roles: [
      { title: "Create security service forms" },
      { title: "Edit security service forms" },
      { title: "Delete security service forms" },
      { title: "Export security service" },
      { title: "Load security service pins & serials" },
      { title: "Delete security service pins & serials" },
      { title: "Export security service pins & serials" },
    ],
  },
  {
    title: "Cinema Tickets",
    roles: [
      { title: "Create cinema tickets" },
      { title: "Edit cinema tickets" },
      { title: "Delete cinema tickets" },
      { title: "Export cinema tickets" },
      { title: "Load cinema tickets pins & serials" },
      { title: "Delete cinema tickets pins & serials" },
      { title: "Export cinema tickets pins & serials" },
    ],
  },
  {
    title: "Stadium Tickets",
    roles: [
      { title: "Create stadium tickets" },
      { title: "Edit stadium tickets" },
      { title: "Delete stadium tickets" },
      { title: "Export stadium tickets" },
      { title: "Load stadium tickets pins & serials" },
      { title: "Delete stadium tickets pins & serials" },
      { title: "Export stadium tickets pins & serials" },
    ],
  },
  {
    title: "Bus Tickets",
    roles: [
      { title: "Create bus tickets" },
      { title: "Edit bus tickets" },
      { title: "Delete bus tickets" },
      { title: "Export bus tickets" },
      { title: "Load bus tickets pins & serials" },
      { title: "Delete bus tickets pins & serials" },
      { title: "Export bus tickets pins & serials" },
    ],
  },

  {
    title: "Prepaid Units",
    roles: [
      { title: "View Meters" },
      { title: "View Prepaid Transaction" },
      { title: "Process Prepaid Transaction" },
      { title: "Export Prepaid Transaction" },
    ],
  },

  {
    title: "Airtime",
    roles: [
      { title: "View Bulk Airtime Transaction" },
      { title: "Process Bulk Airtime Transaction" },
      { title: "Export Bulk Airtime Transaction" },
    ],
  },

  {
    title: "Agents",
    roles: [
      { title: "Add new agents" },
      { title: "Edit agents" },
      { title: "Delete agents" },
      { title: "Export agents information" },
    ],
  },
  {
    title: "Employees",
    roles: [
      { title: "Add new employees" },
      { title: "Edit employees" },
      { title: "Delete employees" },
      { title: "Manage Roles & Permissions" },
      { title: "Export employees information" },
    ],
  },

  {
    title: "Users",
    roles: [
      { title: "Add new users" },
      { title: "Edit users" },
      { title: "Delete users" },
      { title: "Export users details" },
    ],
  },

  {
    title: "User Wallets",
    roles: [
      { title: "Topup user wallet amount" },
      { title: "View user wallet Transaction" },
      { title: "Export user wallet balance" },
      { title: "Export user wallet Transaction" },
    ],
  },

  {
    title: "Agent Wallets",
    roles: [
      { title: "Topup agent wallet amount" },
      { title: "View agent wallet Transaction" },
      { title: "Export agent wallet balance" },
      { title: "Export agent wallet Transaction" },
    ],
  },
  {
    title: "Messages",
    roles: [
      { title: "Create new messages" },
      { title: "Delete messages" },
      { title: "Export messages" },
    ],
  },

  {
    title: "Summary",
    roles: [
      { title: "View All Tickets & Voucher Transactions" },
      { title: "View All Prepaid Units Transactions" },
      { title: "View All Airtime Transactions" },
      { title: "View All Data Bundle Transactions" },
      { title: "View All Transactions" },
      { title: "Export Transactions" },
      { title: "View All Transactions Report" },
      { title: "View User Transactions" },
    ],
  },

  {
    title: "Settings",
    roles: [{ title: "Manage Modules" }],
  },
];

export const CREATE_VOUCHER_ROLES = [
  "Create new checkers",
  "Create new forms",
  "Create security service forms",
  "Create cinema tickets",
  "Create stadium tickets",
  "Create bus tickets",
];

export const LOGS_COLUMNS = [
  { title: "ID", field: "id", hidden: true },
  {
    title: "Modified At",
    field: "createdAt",
    render: ({ createdAt }) =>
      format(new Date(createdAt), "MMMM d, yyyy h:mm a"),
    searchable: true,
    customFilterAndSearch: (data, rowData) => {
      const date = format(new Date(rowData.createdAt), "MMMM d, yyyy h:mm a");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
  },
  { title: "Activity", field: "title" },
  {
    title: "Severity",
    field: "severity",
    render: ({ severity }) => (
      <Button
        size="small"
        sx={{
          color: "white",
          bgcolor: `${severity}.main`,
          borderRadius: 1,
          p: 1,
          textTransform: "uppercase",
        }}
      >
        {severity === "error" ? "Danger" : severity}
      </Button>
    ),
  },
  { title: "User", field: "name" },
  {
    title: "Contact",
    field: null,
    searchable: true,
    customFilterAndSearch: (data, { email, phonenumber }) => {
      return (
        email?.toLowerCase().lastIndexOf(data.toLowerCase()) > -1 ||
        phonenumber.toLowerCase().lastIndexOf(data.toLowerCase()) > -1
      );
    },
    render: ({ email, phonenumber }) => {
      return (
        <Stack>
          <Typography variant="body2" color="info.main">
            {email}
          </Typography>
          <Typography variant="body2">{phonenumber}</Typography>
        </Stack>
      );
    },
  },

  {
    title: "Email Address",
    field: "email",
    hidden: true,
    export: true,
  },
  {
    title: "Telephone No.",
    field: "phonenumber",
    hidden: true,
    export: true,
  },
];

export const METERS_COLUMNS = [
  { title: "ID", field: "id", hidden: true },
  { title: "Created ON", field: "modifiedAt" },
  { title: "Number", field: "number" },
  { title: "Name", field: "name" },
  { title: "Provider", field: "providerName" },
  { title: "Type", field: "type" },
  // { title: "District", field: "district" },
  { title: "Address", field: "address" },
  {
    title: "Status",
    field: "active",
    render: ({ active }) => <Active active={Boolean(active)} />,
  },
];

export const PROCESSED_TRANSACTIONS = [
  {
    title: "Date",
    field: "createdAt",
    render: ({ createdAt }) =>
      format(new Date(createdAt), "MMMM d, yyyy h:mm a"),
    searchable: true,
    customFilterAndSearch: (data, rowData) => {
      const date = format(new Date(rowData.createdAt), "MMMM d, yyyy h:mm a");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
  },
  {
    title: "Status",
    field: "status",
    render: ({ status }) => <StatusChip status={status} />,
  },
  { title: "Transaction ID", field: "id" },
  // { title: "Order ID", field: "paymentId" },
  { title: "Transaction Token", field: "info.rechargeToken" },
  { title: "Meter No.", field: "meter.number" },
  { title: "Meter Type.", field: "meter.type", hidden: true },
  { title: "Meter ID", field: "meter.meterId", hidden: true },
  {
    title: "Top Up Amount",
    field: "amount",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
    },
    hidden: true,
  },

  {
    title: "Amount Paid",
    field: "amount",
    type: "currency",
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
    },
  },
  {
    title: "Contact",
    field: null,
    hidden: true,
    searchable: true,
    customFilterAndSearch: (data, { email, phonenumber }) => {
      return (
        email?.toLowerCase().lastIndexOf(data.toLowerCase()) > -1 ||
        phonenumber.toLowerCase().lastIndexOf(data.toLowerCase()) > -1
      );
    },
    render: ({ email, phonenumber }) => {
      return (
        <Stack>
          <Typography variant="body2" color="info.main">
            {email}
          </Typography>
          <Typography variant="body2">{phonenumber}</Typography>
        </Stack>
      );
    },
  },

  { title: "Mobile Number.", field: "phonenumber", hidden: true },
  { title: "Customer Email.", field: "email", hidden: true },
  { title: "Customer LastCharge", field: "info.lastCharge", hidden: true },
  {
    title: "Customer Last Month Consumption",
    field: "info.lastMonthConsumption",
    hidden: true,
  },
];

export const airtimeTransactionsColumns = (type) => [
  {
    title: "Date",
    field: "createdAt",
    render: ({ createdAt }) =>
      format(new Date(createdAt), "MMMM d, yyyy h:mm a"),
    searchable: true,
    customFilterAndSearch: (data, rowData) => {
      const date = format(new Date(rowData.createdAt), "MMMM d, yyyy h:mm a");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
  },
  {
    title: "Status",
    field: "status",
    customFilterAndSearch: (data, rowData) => {
      return (
        rowData?.status?.toLowerCase().lastIndexOf(data.toLowerCase()) > -1
      );
    },
    render: ({ status, isProcessed }) => (
      <Button
        size="small"
        label={
          status === "completed" && Boolean(isProcessed)
            ? "Completed"
            : status === "refunded" && Boolean(isProcessed)
              ? "Refunded"
              : "Pending"
        }
        sx={{
          color: "#fff",
          bgcolor:
            status === "completed" && Boolean(isProcessed)
              ? "success.darker"
              : status === "refunded" && Boolean(isProcessed)
                ? "secondary.main"
                : "warning.darker",
          borderRadius: 1,
        }}
      >
        {status === "completed" && Boolean(isProcessed)
          ? "Completed"
          : status === "refunded" && Boolean(isProcessed)
            ? "Refunded"
            : "Pending"}
      </Button>
    ),
  },
  {
    title: "TRANSACTION Id",
    field: "id",
    // hidden: true,
  },
  {
    title: "Domain",
    field: "domain",
  },
  {
    title: "Recipient",
    field: "recipient",
    render: (row) =>
      type === "single" ? (
        row?.recipient
      ) : (
        <Stack>
          {JSON.parse(row?.recipient).map((item) => (
            <small key={item?.recipient}>
              {item?.recipient}{" "}
              <b style={{ color: "var(--secondary)" }}>
                ({currencyFormatter(item?.price)})
              </b>
            </small>
          ))}
        </Stack>
      ),
  },

  {
    title: "Kind",
    field: "kind",
  },
  {
    title: "Email",
    field: "email",
  },
  {
    title: "Telephone Number",
    field: "phonenumber",
  },
  {
    title: "Amount",
    field: "amount",
    type: "currency",
    align: "center",
    cellStyle: {
      textAlign: "center",
    },
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  },
];

export const userTransactionsColumns = (type) => [
  {
    title: "Date",
    field: "createdAt",
    render: ({ createdAt }) =>
      format(new Date(createdAt), "MMMM d, yyyy h:mm a"),
    searchable: true,
    customFilterAndSearch: (data, rowData) => {
      const date = format(new Date(rowData.createdAt), "MMMM d, yyyy h:mm a");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
  },
  {
    title: "Status",
    field: "status",
    render: ({ status }) => <StatusChip status={status} />,
  },
  {
    title: "TRANSACTION Id",
    field: "id",
    // hidden: true,
  },
  {
    title: "Domain",
    field: "domain",
    cellStyle: {
      textTransform: "capitalize",
    },
  },
  {
    title: "Link",
    field: "downloadLink",
    hidden: true,
  },

  type === "prepaid"
    ? {
        title: "Meter",
        field: "voucherType",
        render: (row) => row?.meter,
      }
    : type === "bundle"
      ? {
          title: "Bundle Name",
          field: "kind",
        }
      : {
          title: "Voucher/Ticket",
          field: "voucherType",
          render: (row) => row?.voucherType,
        },
  type === "bundle"
    ? { title: "Volume", field: "volume" }
    : {
        title: "Type",
        field: "type",
      },
  {
    title: "Email",
    field: "email",
  },
  {
    title: "Telephone Number",
    field: "phonenumber",
  },
  {
    title: "Amount",
    field: "amount",
    type: "currency",
    align: "center",
    cellStyle: {
      textAlign: "center",
    },
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  },
];

export const airtimeTransactionsByColumns = [
  {
    title: "Date",
    field: "createdAt",
    render: ({ createdAt }) =>
      format(new Date(createdAt), "MMMM d, yyyy h:mm a"),
    searchable: true,
    customFilterAndSearch: (data, rowData) => {
      const date = format(new Date(rowData.createdAt), "MMMM d, yyyy h:mm a");
      return date.toLowerCase().lastIndexOf(data.toLowerCase()) > -1;
    },
  },
  {
    title: "Status",
    field: "status",
    render: ({ status }) => <StatusChip status={status} />,
  },
  {
    title: "Id",
    field: "_id",
    // hidden: true,
  },
  {
    title: "Payment Reference",
    field: "reference",
    // hidden: true,
  },
  {
    title: "Recipient",
    field: "recipient",
  },
  {
    title: "Provider",
    field: "provider",
  },
  {
    title: "Type",
    field: "type",
  },
  {
    title: "Details",
    field: "info.plan_name",
    export: true,
    render: ({ info }) => {
      return `
      ${info?.type || "N/A"}
      ${info?.plan_name || ""}
      ${info?.volume || ""}

      `;
    },
  },
  {
    title: "Total Amount",
    field: "amount",
    type: "currency",
    align: "center",
    cellStyle: {
      textAlign: "center",
    },
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    },
  },
  {
    title: "Commission",
    field: "commission",
    type: "currency",
    align: "center",
    cellStyle: {
      textAlign: "center",
    },
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    },
  },
  {
    title: "Payable Amount",
    field: "amt",
    type: "currency",
    align: "center",
    cellStyle: {
      textAlign: "center",
    },
    currencySetting: {
      currencyCode: "GHS",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    },
  },
];

export const StatusChip = ({ status }) => (
  <Chip
    label={status}
    size="small"
    color={
      status === "completed"
        ? "success"
        : status === "pending"
          ? "warning"
          : status === "failed"
            ? "error"
            : "secondary"
    }
    sx={{ color: "#fff", textTransform: "capitalize" }}
  />
);

  

export const DateRenderer = ({ date }) => (
  <ListItemText
    primary={format(new Date(date), "EEEE, MMMM d, yyyy")}
        secondary={format(new Date(date), "h:mm a")}
    primaryTypographyProps={{
      fontSize: 14,
    }}
    secondaryTypographyProps={{
      fontSize: 14,
      color: "text.secondary",
    }}
  />
);
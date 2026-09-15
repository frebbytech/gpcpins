const router = require("express").Router();
const asyncHandler = require("express-async-handler");
const _ = require("lodash");
const { v4: uuidv4 } = require("uuid");
const generateId = require("../config/generateId");

//model

const { isValidUUID2 } = require("../config/validation");

const knex = require("../db/knex");
const verifyAdmin = require("../middlewares/verifyAdmin");
const { verifyToken } = require("../middlewares/verifyToken");
const { getMeter } = require("../services/brassica/token.manager");
const { brassicaPost } = require("../services/brassicaClient");

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const meterNo = req.query?.meterNo;

    if (meterNo) {
      const meter = await knex("meters")
        .select(
          "id",
          "name",
          "number",
          "type",
          "spn",
          "address",
          "district",
          "geo_code as geoCode",
          "account_number as accountNumber",
          "created_at as createdAt",
          "updated_at as updatedAt",
        )
        .where("number", meterNo)
        .first();

      return res.status(200).json(meter);
    }

    // const meters = await Meter.find({});
    const meters = await knex("meters")
      .select(
        "id",
        "name",
        "number",
        "type",
        "provider_name as providerName",
        "address",
        "district",
        "active",
        "geo_code as geoCode",
        "account_number as accountNumber",
        "created_at as createdAt",
        "updated_at as updatedAt",
        knex.raw("DATE_FORMAT(created_at,'%D %M %Y 🔸 %r') as modifiedAt"),
      )
      .orderBy("created_at", "desc");

    // console.log(meters);

    res.status(200).json(meters);
  }),
);

router.get(
  "/all",
  verifyAdmin,
  asyncHandler(async (req, res) => {
    const meters = await knex("meters").select(
      "*",
      "geo_code as geoCode",
      "account_number as accountNumber",
      "created_at as createdAt",
      "updated_at as updatedAt",
    );
    res.status(200).json(meters);
  }),
);

router.get(
  "/meter/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid Request ID!");
    }

    const meter = await knex("meters")
      .select(
        "id",
        "name",
        "number",
        "type",
        "spn",
        "address",
        "district",
        "geo_code as geoCode",
        "account_number as accountNumber",
        "created_at as createdAt",
        "updated_at as updatedAt",
      )
      .where("number", id)
      .first();

    res.status(200).json(meter);
  }),
);
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid Request ID!");
    }

    const meter = await knex("meters")
      .select(
        "id",
        "name",
        "number",
        "type",
        "spn",
        "address",
        "district",
        "geo_code as geoCode",
        "account_number as accountNumber",
        "created_at as createdAt",
        "updated_at as updatedAt",
      )
      .where("id", id)
      .first();

    res.status(200).json(meter);
  }),
);
router.get(
  "/user/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid Request ID!");
    }

    const meters = await knex("meters")
      .select(
        "id",
        "name",
        "number",
        "type",
        "spn",
        "address",
        "district",
        "provider_name",
        "geo_code as geoCode",
        "account_number as accountNumber",
        "created_at as createdAt",
        "updated_at as updatedAt",
      )
      .where("user_id", id)
      .orderBy("created_at", "desc");

    res.status(200).json(meters);
  }),
);

router.post(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    let availableMeter = null;
    const newMeter = req.body;

    const ifMeterExists = await knex("meters")
      .where({
        number: newMeter?.number,
        user_id: newMeter.user_id,
      })
      .first();

    if (!_.isEmpty(ifMeterExists)) {
      return res.status(404).json("Meter already exist!.");
    }

    const savedMeter = await getMeter(`meter:${newMeter?.number}`);
    if (savedMeter) {
      availableMeter = savedMeter;
    } else {
      try {
        const transactionId = uuidv4();
        const response = await brassicaPost("/billerAccountLookUp", {
          transactionId,
          accountNumber: newMeter?.number,
          phoneNumber: process.env.BRASSICA_CLIENT_PHONENUMBER,
          accountCategory: "PREPAID",
          billerType: "ECG",
        });

        if (response?.status !== "Success" || response?.statusCode !== "200") {
          return res.status(401).json("An error has occurred!.Meter not found");
        }

        availableMeter = response;
      } catch (error) {
        return res
          .status(500)
          .json("An error has occurred!.Could not save meter details.");
      }
    }


    const meterDetails = {
      id: generateId(),
      user_id: newMeter?.user_id,
      number: newMeter?.number,
      spn: "",
      name: availableMeter?.accountDetails?.accountName,
      type: availableMeter?.accountDetails?.accountType,
      district: availableMeter?.accountDetails?.serviceDistrictId,
      address: availableMeter?.accountDetails?.accountAddress,
      geo_code: "",
      account_number: newMeter?.number,
      reference_id: availableMeter?.accountDetails?.accountReferenceId,
      region: availableMeter?.accountDetails?.serviceRegionId,
      provider_name: availableMeter?.accountDetails?.serviceProviderName,
      alt_account_number: availableMeter?.accountDetails?.altAccountNumber,
      look_up_id: availableMeter?.accountLookUpId,
    };

    const meter = await knex("meters").insert(meterDetails);

    if (_.isEmpty(meter)) {
      return res.status(400).json("Error saving meter information!");
    }

    res.status(201).json("Meter saved!");
  }),
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const { id, ...rest } = req.body;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid Request!");
    }

    const meter = await knex("meters").where("id", id).update(rest);

    if (meter !== 1) {
      return res.status(404).json("Error updating meter information!");
    }
    res.status(201).json("Meter info updated successfully!!!");
  }),
);

router.delete(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { id } = req.query;

    if (!isValidUUID2(id)) {
      return res.status(400).json("Invalid Request!");
    }

    const meter = await knex("meters").where("id", id).del();

    if (meter !== 1) {
      return res.status(404).json("Error removing meter!");
    }
    res.status(200).json("Meter removed!");
  }),
);

module.exports = router;

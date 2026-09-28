import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: [
        "admin",
        "accounting_manager",
        "accountant",
        "billing_executive",
        "data-entry",
        "auditor",
        "external_ca",
      ],
      default: "data-entry",
    },
    companyId: { type: mongoose.Types.ObjectId, ref: "Company", required: true },
    active: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    active: this.active,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model("User", userSchema);
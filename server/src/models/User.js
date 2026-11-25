import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => ({ id: ret._id.toString(), name: ret.name, email: ret.email }),
});

export const User = mongoose.model('User', userSchema);

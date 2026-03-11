import bcrypt from "bcryptjs";
import { getCollection } from "./mongodb";
import type { User, Admin, Student } from "./models";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// --- User (regular users - users collection) ---
export async function findUserByEmail(email: string): Promise<User | null> {
  const usersCollection = await getCollection<User>("users");
  return usersCollection.findOne({ email: email.toLowerCase() });
}

export async function createUser(email: string, password: string, name?: string): Promise<User> {
  const usersCollection = await getCollection<User>("users");
  const hashedPassword = await hashPassword(password);

  const user: User = {
    email: email.toLowerCase(),
    password: hashedPassword,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await usersCollection.insertOne(user);
  return { ...user, _id: result.insertedId };
}

export async function verifyUser(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const isValid = await comparePassword(password, user.password);
  return isValid ? user : null;
}

// --- Admin (admins collection - separate from users) ---
export async function findAdminByEmail(email: string): Promise<Admin | null> {
  const adminsCollection = await getCollection<Admin>("admins");
  return adminsCollection.findOne({ email: email.toLowerCase() });
}

export async function createAdmin(email: string, password: string, name?: string): Promise<Admin> {
  const adminsCollection = await getCollection<Admin>("admins");
  const hashedPassword = await hashPassword(password);

  const admin: Admin = {
    email: email.toLowerCase(),
    password: hashedPassword,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await adminsCollection.insertOne(admin);
  return { ...admin, _id: result.insertedId };
}

export async function verifyAdmin(email: string, password: string): Promise<Admin | null> {
  const admin = await findAdminByEmail(email);
  if (!admin) return null;
  const isValid = await comparePassword(password, admin.password);
  return isValid ? admin : null;
}

// Find student by rollNo or studentId
export async function findStudentByIdentifier(identifier: string): Promise<Student | null> {
  const studentsCollection = await getCollection<Student>("students");
  const student = await studentsCollection.findOne({
    $or: [
      { rollNo: identifier },
      { studentId: identifier },
    ],
  });
  return student;
}

// Login user by student ID (rollNo or studentId) - finds student, then finds user by email
export async function verifyUserByStudentId(identifier: string, password: string): Promise<User | null> {
  const student = await findStudentByIdentifier(identifier);
  if (!student || !student.email) return null;
  return verifyUser(student.email, password);
}

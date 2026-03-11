import { Hono } from "hono";
import { getCollection } from "../../lib/mongodb";
import { findUserByEmail } from "../../lib/auth";
import type { User } from "../../lib/models";

export const usersRoutes = new Hono();

// Get all users (admin only)
usersRoutes.get("/", async (c) => {
  try {
    const usersCollection = await getCollection<User>("users");
    const users = await usersCollection
      .find({})
      .project({ password: 0 }) // Exclude password
      .sort({ createdAt: -1 })
      .toArray();
    
    return c.json({
      success: true,
      data: users.map(({ _id, ...user }) => ({
        ...user,
        createdAt: user.createdAt?.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
      })),
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to fetch users" }, 500);
  }
});

// Get single user (admin only)
usersRoutes.get("/:email", async (c) => {
  try {
    const email = c.req.param("email");
    const user = await findUserByEmail(email);
    
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    
    const { password, ...userData } = user;
    
    return c.json({
      success: true,
      data: {
        ...userData,
        createdAt: user.createdAt?.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to fetch user" }, 500);
  }
});

// Delete user (admin only)
usersRoutes.delete("/:email", async (c) => {
  try {
    const email = c.req.param("email");
    const usersCollection = await getCollection<User>("users");
    
    const user = await findUserByEmail(email);
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    
    await usersCollection.deleteOne({ email: email.toLowerCase() });
    
    return c.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message || "Failed to delete user" }, 500);
  }
});

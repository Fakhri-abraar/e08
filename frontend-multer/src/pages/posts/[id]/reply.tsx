import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../../contexts/AuthContext";

interface Author {
  username: string;
}

interface Post {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: Author;
  replyToId?: string;
}

export default function ReplyToPost() {
  // ... (State definitions)
  const [post, setPost] = useState<Post | null>(null);
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { id: postId } = router.query;
  const { user, token } = useAuth();

  // ... (useEffect for fetching post)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    // TODO
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(URL.createObjectURL(file));
    } else {
      removeImage();
    }
    // --- End TODO ---
  }

  function removeImage() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!content.trim() || !token) return;

    setIsSubmitting(true);

    try {
      let imagePath: string | undefined;

      // Upload image if selected
      if (imageFile) {
        // TODO: Upload image
        const formData = new FormData();
        formData.append("image", imageFile);

        const uploadResponse = await fetch("http://localhost:3000/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
           if (uploadResponse.status === 413) throw new Error("File too large");
           throw new Error("Failed to upload image");
        }

        const uploadData = await uploadResponse.json();
        imagePath = uploadData.imagePath;
        // --- End TODO ---
      }

      // TODO: Create reply post
      const response = await fetch("http://localhost:3000/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: content.trim(),
          imagePath: imagePath,
          replyToId: postId, // Hubungkan reply dengan parent post
        }),
      });
      // --- End TODO ---

      if (response.ok) {
        router.push(`/posts/${postId}`);
      } else if (response.status === 401) {
        alert("Please login to create a reply");
        router.push("/auth/login");
      } else {
        alert("Error creating reply");
      }
    } catch (error) {
      alert(
        "Error creating reply: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ... (Render JSX)
  if (loading) {
    return <div className="text-center">Loading...</div>;
  }
  
  if (!post) return <div>Post not found</div>;
  if (!user) return null;

  return (
      <>
        <h1>Reply to Post</h1>
        {/* ... (Tampilkan parent post) ... */}
        
        <form onSubmit={handleSubmit}>
            {/* ... (Input content dan image sama seperti di new.tsx) ... */}
            <div className="mb-3">
            <label htmlFor="content" className="form-label">Your Reply</label>
            <textarea className="form-control" id="content" rows={5} required 
                value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
            <div className="mb-3">
            <label htmlFor="image" className="form-label">Image (optional)</label>
            <input type="file" className="form-control" id="image" accept="image/*" 
                onChange={handleImageChange} disabled={isSubmitting} />
            </div>
            {imagePreview && (
                <div className="mb-3 position-relative" style={{ maxWidth: "400px" }}>
                    <img src={imagePreview} alt="Preview" className="img-fluid rounded" />
                    <button type="button" className="btn btn-sm btn-danger position-absolute top-0 end-0 m-2" onClick={removeImage}>Remove</button>
                </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>Post Reply</button>
        </form>
      </>
  );
}
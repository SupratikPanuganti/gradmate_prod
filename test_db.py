from supabase import create_client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = "https://ftpzfcgrokfwquqdlfya.supabase.co"
supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0cHpmY2dyb2tmd3F1cWRsZnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1ODQxMTAsImV4cCI6MjA2NTE2MDExMH0.WsMZP4A9uhvunkUK83MWUcVL2O3c0XVNUt-UCadnPPk"

supabase = create_client(supabase_url, supabase_key)

# def test_auth_and_profile():
#     try:
#         # First, sign up a test user
#         print("\nTesting user signup...")
#         signup_response = supabase.auth.sign_up({
#             "email": "test@example.com",
#             "password": "testpassword123"
#         })
        
#         if signup_response.user:
#             print("Signup successful!")
#             user_id = signup_response.user.id
#             print(f"User ID: {user_id}")
            
#             # Now try to update the profile (since it's automatically created by the trigger)
#             print("\nTesting profile update...")
#             profile_data = {
#                 "full_name": "Test User",
#                 "current_school": "Test University",
#                 "graduation_year": "2024",
#                 "gpa": "3.8",
#                 "major": "Computer Science",
#                 "minor": "Mathematics",
#                 "interests": "AI, ML, Data Science"
#             }
            
#             profile_response = supabase.table('profiles').update(profile_data).eq("id", user_id).execute()
#             print("Profile update successful!")
#             print("Profile data:", profile_response.data)
            
#             # Test retrieving the profile
#             print("\nTesting profile retrieval...")
#             get_response = supabase.table('profiles').select("*").eq("id", user_id).execute()
#             print("Retrieved profile:", get_response.data)
            
#             return True
#         else:
#             print("Signup failed - no user returned")
#             return False
            
#     except Exception as e:
#         print("Test failed!")
#         print("Error:", str(e))
#         return False

# if __name__ == "__main__":
#     print("Starting database tests...")
#     test_auth_and_profile() 
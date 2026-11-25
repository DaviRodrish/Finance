import os
from dotenv import load_dotenv

load_dotenv()

LOCAL_USER_ID = os.getenv("LOCAL_USER_ID", "local-user")


def get_current_user_id() -> str:
    return LOCAL_USER_ID
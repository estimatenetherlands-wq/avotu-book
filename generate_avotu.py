import sys
import os
import requests
import base64
from google.cloud import aiplatform
from google.cloud.aiplatform.gapic.schema import predict

def generate_avotu(prompt, output_file="avotu_new_render.png"):
    project = "project-22f5ac8a-d5f1-4a3d-a16"
    location = "us-central1"
    
    # Path to the local reference image
    ref_image_path = r"c:\Users\estim\Desktop\книга\dataset\avotu\avotu_final_reference_sad_black_eyes_1775580252039.png"
    
    with open(ref_image_path, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode("utf-8")

    # Initialize Vertex AI
    aiplatform.init(project=project, location=location)
    
    # Endpoint for Imagen 4 Ultra
    endpoint_id = "publishers/google/models/imagen-4.0-ultra-generate-001"
    
    # Instance with Base64 reference image
    instance = {
        "prompt": f"A high-quality studio portrait of [1], {prompt}. Dark fantasy, cinematic lighting, obsidian black eyes, black flame hair, highly detailed oil painting.",
        "referenceImages": [
            {
                "referenceId": 1,
                "referenceImage": {
                    "bytesBase64Encoded": encoded_string,
                    "mimeType": "image/png"
                }
            }
        ]
    }
    
    parameters = {
        "sampleCount": 1,
        "aspectRatio": "1:1",
        "personGeneration": "ALLOW_ADULT",
        "outputMimeType": "image/png"
    }

    print(f"Sending request to Vertex AI for: {prompt}...")
    
    client_options = {"api_endpoint": f"{location}-aiplatform.googleapis.com"}
    client = aiplatform.gapic.PredictionServiceClient(client_options=client_options)
    
    endpoint = f"projects/{project}/locations/{location}/{endpoint_id}"
    
    response = client.predict(
        endpoint=endpoint,
        instances=[instance],
        parameters=parameters,
    )

    for prediction in response.predictions:
        image_data = base64.b64decode(prediction["bytesBase64Encoded"])
        with open(output_file, "wb") as f:
            f.write(image_data)
        
    print(f"Success! Image generated and saved to: {os.path.abspath(output_file)}")

if __name__ == "__main__":
    combined_prompt = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "standing in the middle of a burning ruined temple, ash falling like snow"
    generate_avotu(combined_prompt)

import json
import os
import requests
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

@api_view(['GET'])
def health(request):
    return Response({'status': 'ok'}, status=200)

# OpenAI API configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_API_URL = 'https://api.openai.com/v1'

@api_view(['POST'])
def validate_and_update_style(request):
    """
    Validate if a style name is fashion-related and generate new search terms
    """
    try:
        new_style = request.data.get('newStyle', '').strip()

        if not new_style:
            return Response({'isValid': False, 'message': 'Style cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

        # Use OpenAI to validate and generate search terms
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {OPENAI_API_KEY}'
        }

        validation_request = {
            'model': 'gpt-4o',
            'max_tokens': 200,
            'messages': [
                {
                    'role': 'system',
                    'content': """You are a fashion expert. Determine if the given text is a valid fashion style name.

Invalid examples: paper, rock, table, computer, nonsense words
Valid examples: Streetwear Chic, Business Casual, Vintage Retro, Sporty Elegant

Return JSON:
{
  "isValid": boolean,
  "message": "explanation if invalid or confirmation if valid",
  "searchTerms": "specific product search terms if valid (5-7 words)"
}"""
                },
                {
                    'role': 'user',
                    'content': f'Is "{new_style}" a valid fashion style? If yes, generate search terms for complementary items.'
                }
            ]
        }

        print(f'Validating style: {new_style}')

        response = requests.post(
            f'{OPENAI_API_URL}/chat/completions',
            json=validation_request,
            headers=headers,
            timeout=10
        )

        if response.status_code != 200:
            print(f'OpenAI validation error: {response.status_code}')
            return Response({
                'isValid': False,
                'message': 'Failed to validate style'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        response_data = response.json()
        content = response_data['choices'][0]['message']['content']

        # Parse the JSON response
        import re
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            validation_result = json.loads(json_match.group())
            print(f'Validation result: {validation_result}')

            return Response({
                'isValid': validation_result.get('isValid', False),
                'message': validation_result.get('message', ''),
                'searchTerms': validation_result.get('searchTerms', '') if validation_result.get('isValid') else None
            })

        return Response({
            'isValid': False,
            'message': 'Could not validate style'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        print(f'Style validation error: {str(e)}')
        return Response({
            'isValid': False,
            'message': 'Validation service error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def search_products(request):
    """
    Search for real products using OpenAI Responses API with web search
    This is the exact logic from openaiService.js searchForProducts function
    """
    try:
        search_terms = request.data.get('searchTerms', '')
        
        if not search_terms:
            return Response({'error': 'Search terms are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Using the Responses API with web_search tool and gpt-5 (exact same request as in JS)
        search_request = {
            'model': 'gpt-5',
            'tools': [{'type': 'web_search'}],
            'input': f"""Search the web for 5 real fashion products currently for sale that match: {search_terms}. 

Focus on finding actual products from retailers like Amazon, Nordstrom, ASOS, Nike, Adidas, Zara, H&M with:
- Exact product names and brands
- Current prices in USD
- Direct product page URLs
- Product images

Return ONLY a JSON array with exactly 5 products in this format:
[
  {{
    "name": "exact product name",
    "brand": "brand name",
    "description": "brief description",
    "price": "$XX.XX",
    "imageUrl": "direct image URL",
    "purchaseUrl": "product page URL"
  }}
]"""
        }
        
        print(f'Searching for products with web search: {search_terms}')
        
        # Make request to OpenAI Responses API - NO TIMEOUT
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {OPENAI_API_KEY}'
        }
        
        response = requests.post(
            f'{OPENAI_API_URL}/responses',
            json=search_request,
            headers=headers
        )
        
        if response.status_code != 200:
            print(f'OpenAI API error: {response.status_code}')
            print(f'Response: {response.text}')
            return Response({
                'error': f'OpenAI API error: {response.status_code}',
                'details': response.text
            }, status=response.status_code)
        
        response_data = response.json()
        
        # Parse the response from the Responses API format (exact same parsing as JS)
        content = ''
        
        # According to docs, the response has an 'output' array with web_search_call and message items
        if 'output' in response_data and isinstance(response_data['output'], list):
            # Find the message output item (type: 'message')
            for item in response_data['output']:
                if item.get('type') == 'message':
                    if 'content' in item and isinstance(item['content'], list):
                        # The content is an array with output_text objects
                        for c in item['content']:
                            if c.get('type') == 'output_text' and 'text' in c:
                                content = c['text']
                                break
                    break
        
        print(f'Raw search response: {content}')
        
        if not content:
            print(f'No content found in response: {json.dumps(response_data, indent=2)}')
            return Response({'products': []})
        
        # Extract JSON array from content
        import re
        json_match = re.search(r'\[[\s\S]*\]', content)
        if json_match:
            products = json.loads(json_match.group())
            print(f'Parsed products: {products}')
            
            # Return products directly - NO FALLBACKS, NO PLACEHOLDERS
            return Response({'products': products})
        
        print('No products found in response')
        return Response({'products': []})
        
    except requests.exceptions.ConnectionError:
        print('Network or configuration error')
        return Response({
            'error': 'Network error',
            'products': []
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as e:
        print(f'Product search error: {str(e)}')
        return Response({
            'error': str(e),
            'products': []
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
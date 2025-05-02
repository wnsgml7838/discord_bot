#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
백준 문제 추천 시스템 (새로운 로직)
- solved.ac API를 활용해 사용자의 태그 티어와 레이팅 기반으로 문제 추천
- 사용자가 너무 쉽게 느끼지도 너무 어렵게 느끼지도 않는 난이도의 문제 추천
"""

import requests
import json
from collections import Counter
import sys
import time
import random
import math

# API 엔드포인트
SOLVED_API_BASE = "https://solved.ac/api"
USER_SOLVED_ENDPOINT = f"{SOLVED_API_BASE}/v3/search/problem"
PROBLEM_DETAIL_ENDPOINT = f"{SOLVED_API_BASE}/v3/problem/show"
PROBLEM_SEARCH_ENDPOINT = f"{SOLVED_API_BASE}/v3/search/problem"
USER_INFO_ENDPOINT = f"{SOLVED_API_BASE}/v3/user/show"
BOJ_BASE_URL = "https://boj.kr"

# 캐시 설정
problem_details_cache = {}  # 문제 세부 정보 캐시
user_info_cache = {}        # 사용자 정보 캐시

# 티어 매핑 (1~30 -> Bronze 5 ~ Ruby 1)
def get_tier_name(tier):
    tier_colors = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ruby"]
    tier_levels = ["V", "IV", "III", "II", "I"]
    
    if tier == 0:
        return "Unrated"
    
    color_idx = (tier - 1) // 5
    level_idx = 4 - ((tier - 1) % 5)
    
    if color_idx >= len(tier_colors):
        return "Master"
    
    return f"{tier_colors[color_idx]} {tier_levels[level_idx]}"

# 한국어 티어 이름
def get_tier_name_ko(tier):
    tier_colors = ["브론즈", "실버", "골드", "플래티넘", "다이아몬드", "루비"]
    tier_levels = ["5", "4", "3", "2", "1"]
    
    if tier == 0:
        return "언레이티드"
    
    color_idx = (tier - 1) // 5
    level_idx = 4 - ((tier - 1) % 5)
    
    if color_idx >= len(tier_colors):
        return "마스터"
    
    return f"{tier_colors[color_idx]} {tier_levels[level_idx]}"

# 요청에 지연시간 추가 (API 제한 방지)
def rate_limited_request(url, params=None):
    time.sleep(0.5)  # 0.5초 지연
    response = requests.get(url, params=params)
    if response.status_code != 200:
        print(f"API 요청 실패: {response.status_code}")
        print(response.text)
        return None
    return response.json()

# 사용자가 푼 문제 가져오기
def get_solved_problems(handle):
    # solved_by 쿼리 파라미터 사용
    params = {
        "query": f"solved_by:{handle}",
        "page": 1,
        "sort": "id",
        "direction": "asc",
        "limit": 100
    }
    
    solved_problems = []
    solved_problems_with_details = []  # 세부 정보 포함 버전
    page = 1
    
    while True:
        params["page"] = page
        data = rate_limited_request(USER_SOLVED_ENDPOINT, params)
        
        if data is None or "items" not in data or len(data["items"]) == 0:
            break
        
        # 문제 ID 추출 및 세부 정보 저장
        for item in data["items"]:
            solved_problems.append(item["problemId"])
            
            # 기본 세부 정보 저장
            problem_info = {
                "id": item["problemId"],
                "title": item["titleKo"],
                "level": item["level"],
                "tags": [tag["key"] for tag in item.get("tags", [])]
            }
            
            # 캐시에 저장
            problem_details_cache[item["problemId"]] = problem_info
            
            # 세부 정보 배열에 추가
            solved_problems_with_details.append(problem_info)
        
        # 더 이상 데이터가 없거나 최대 페이지에 도달하면 중단
        if len(data["items"]) < params["limit"] or page >= 10:  # 최대 1000개 문제 (10 페이지)
            break
        
        page += 1
    
    print(f"총 {len(solved_problems)}개의 해결한 문제를 찾았습니다.")
    return solved_problems, solved_problems_with_details

# 사용자 정보 가져오기
def get_user_info(handle):
    # 캐시에 있으면 캐시에서 반환
    if handle in user_info_cache:
        return user_info_cache[handle]
    
    # API 요청
    params = {"handle": handle}
    data = rate_limited_request(USER_INFO_ENDPOINT, params)
    
    if data is None:
        return None
    
    # 필요한 정보만 추출
    user_info = {
        "handle": data["handle"],
        "tier": data.get("tier", 0),
        "rank": data.get("rank", 0),
        "solved_count": data.get("solvedCount", 0),
        "class": data.get("class", 0),
        "rating": data.get("rating", 0)
    }
    
    # 캐시에 저장
    user_info_cache[handle] = user_info
    
    return user_info

# 문제 상세 정보 가져오기
def get_problem_details(problem_id):
    # 캐시에 있으면 캐시에서 반환
    if problem_id in problem_details_cache:
        return problem_details_cache[problem_id]
    
    params = {"problemId": problem_id}
    data = rate_limited_request(PROBLEM_DETAIL_ENDPOINT, params)
    
    if data is None:
        return None
    
    # 문제 상세 정보 반환
    problem_info = {
        "id": data["problemId"],
        "title": data["titleKo"],
        "level": data["level"],
        "tags": [tag["key"] for tag in data.get("tags", [])]
    }
    
    # 캐시에 저장
    problem_details_cache[problem_id] = problem_info
    
    return problem_info

# 새로운 로직: 사용자의 TagTier 계산 함수
def calculate_tag_tiers(solved_problems_with_details):
    """
    사용자가 해결한 문제를 기반으로 태그별 티어를 계산합니다.
    """
    tag_problems = {}  # 태그별 문제 목록
    tag_tiers = {}     # 태그별 최종 티어
    
    # 태그별로 문제 분류
    for problem in solved_problems_with_details:
        for tag in problem.get("tags", []):
            if tag not in tag_problems:
                tag_problems[tag] = []
            tag_problems[tag].append(problem)
    
    # 태그별 티어 계산 (각 태그에 대해 상위 5개 문제의 평균 티어)
    for tag, problems in tag_problems.items():
        # 난이도(level)별로 정렬하고 상위 5개 (또는 모든 문제) 선택
        sorted_problems = sorted(problems, key=lambda x: x.get("level", 0), reverse=True)
        top_problems = sorted_problems[:min(5, len(sorted_problems))]
        
        # 평균 티어 계산
        if top_problems:
            avg_tier = sum(problem.get("level", 0) for problem in top_problems) / len(top_problems)
            tag_tiers[tag] = round(avg_tier)
        else:
            tag_tiers[tag] = 0
    
    # 모든 태그의 평균 티어 계산
    all_tag_tier = 0
    if tag_tiers:
        all_tag_tier = round(sum(tag_tiers.values()) / len(tag_tiers))
    
    return tag_tiers, all_tag_tier

# 문제 추천을 위한 최종 티어 계산 함수
def calculate_average_tier(user_info, tag_tier):
    """
    사용자의 전체 티어와 태그 티어의 평균을 계산해 최종 추천 티어를 결정합니다.
    사용자 티어에 더 큰 가중치를 부여합니다.
    (참고: 백준 티어는 숫자가 클수록 낮은 티어를 의미합니다. 브론즈5=1, 실버4=9, 실버2=7)
    """
    user_tier = user_info.get("tier", 0)
    
    # 사용자가 unrated인 경우 기본값 설정
    if user_tier == 0:
        user_tier = 5  # 기본값: 브론즈 1
    
    # 태그 티어가 0인 경우 (태그 정보가 충분하지 않은 경우)
    if tag_tier == 0:
        tag_tier = min(30, user_tier + 2)  # 사용자 티어보다 낮게 설정 (숫자가 클수록 낮은 티어)
    
    # 태그 티어가 사용자 티어보다 지나치게 낮은 경우 조정 (숫자가 작을수록 높은 티어)
    if tag_tier < user_tier - 2:
        # 사용자 티어보다 최대 2단계까지만 높게 설정
        tag_tier = user_tier - 2
        print(f"태그 티어({get_tier_name_ko(tag_tier)})가 사용자 티어({get_tier_name_ko(user_tier)})보다 높아 조정되었습니다.")
    
    # 요청에 따라 사용자 티어를 4 (실버 4)로 고정
    if user_tier == 7:  # 실버 2인 경우
        print(f"사용자 요청에 따라 실버4(9)로 고정합니다. (원래 티어: {get_tier_name_ko(user_tier)})")
        return 9  # 실버 4
    
    # 사용자 티어를 그대로 반환 (태그 티어 무시)
    print(f"사용자 티어({get_tier_name_ko(user_tier)})를 최종 추천 티어로 사용합니다.")
    return user_tier

# 메인 함수: 문제 추천 실행
def recommend_problems(handle, page=1):
    """
    사용자의 백준 아이디를 이용해 문제를 추천합니다.
    1. 사용자의 해결한 문제를 가져옵니다.
    2. 태그별 티어를 계산합니다.
    3. 사용자의 레이팅과 태그 티어의 평균을 계산합니다.
    4. 평균 티어에 맞는 문제를 추천합니다.
    """
    print(f"🔍 '{handle}'님의 백준 문제 추천을 시작합니다... (페이지: {page})")
    
    # 1. 사용자의 해결한 문제 가져오기
    solved_problems, solved_problems_with_details = get_solved_problems(handle)
    
    # 사용자가 해결한 문제가 없는 경우
    if not solved_problems:
        print(f"'{handle}'님이 해결한 문제를 찾을 수 없습니다.")
        return "해결한 문제가 없습니다. 문제를 풀고 다시 시도해주세요."
    
    # 2. 사용자 정보 가져오기
    user_info = get_user_info(handle)
    if not user_info:
        print(f"'{handle}'님의 정보를 가져올 수 없습니다.")
        return "사용자 정보를 가져올 수 없습니다. 백준 아이디를 확인해주세요."
    
    print(f"사용자 티어: {get_tier_name_ko(user_info['tier'])}")
    print(f"사용자 레이팅: {user_info['rating']}")
    
    # 3. 태그별 티어 계산
    tag_tiers, all_tag_tier = calculate_tag_tiers(solved_problems_with_details)
    
    # 태그별 티어 정보 출력
    print(f"태그별 티어 계산 결과:")
    for tag, tier in sorted(tag_tiers.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"- {tag}: {get_tier_name_ko(tier)}")
    print(f"전체 태그 평균 티어: {get_tier_name_ko(all_tag_tier)}")
    
    # 4. 최종 추천 티어 계산
    average_tier = calculate_average_tier(user_info, all_tag_tier)
    print(f"최종 추천 티어: {get_tier_name_ko(average_tier)}")
    
    # 5. 태그 기반 문제 추천
    tag_based_problems = recommend_tag_based_problems(average_tier, solved_problems, solved_problems_with_details, page)
    print(f"태그 기반 추천 문제 수: {len(tag_based_problems)}")
    
    # 6. 인기도 기반 문제 추천
    # 태그 기반 문제가 없으면 인기도 기반 문제를 5개로 늘림
    popularity_count = 5 if len(tag_based_problems) == 0 else 3
    popularity_based_problems = recommend_popularity_based_problems(average_tier, solved_problems, solved_problems_with_details, page, popularity_count)
    print(f"인기도 기반 추천 문제 수: {len(popularity_based_problems)}")
    
    # 7. 최종 추천 문제 목록 생성
    recommended_problems = tag_based_problems + popularity_based_problems
    
    # 문제를 티어 기준으로 정렬 (오름차순 - 낮은 티어/쉬운 문제가 먼저 나오도록)
    recommended_problems.sort(key=lambda x: x["level"])
    
    # 8. 결과 출력
    result = format_recommendations(recommended_problems, average_tier)
    
    # 9. 안내 메시지 추가
    tag_count = len(tag_based_problems)
    popularity_count = len(popularity_based_problems)
    
    if tag_count == 0:
        recommendation_msg = f"인기도 기반으로 {popularity_count}개의 문제를 추천합니다."
    else:
        recommendation_msg = f"태그 기반으로 {tag_count}개, 인기도 기반으로 {popularity_count}개의 문제를 추천합니다."
    
    explanation = f"""
🎯 추천 방식:
1️⃣ 태그 기반: 사용자가 가장 많이 푼 태그의 문제를 추천합니다. 실력에 맞는 적절한 난이도의 문제를 제안합니다.
2️⃣ 인기도 기반: 많은 사용자들이 푼 인기 있는 문제를 추천합니다. 백준 문제 풀이에 도움이 되는 기본적인 문제들입니다.

💡 티어 정보: 사용자 티어는 {get_tier_name_ko(user_info['tier'])}(레이팅: {user_info['rating']})이며, 
  추천 티어는 {get_tier_name_ko(average_tier)}로 계산되었습니다.
  
📊 총 {len(solved_problems)}개의 문제를 분석했으며, {recommendation_msg}
📄 현재 페이지: {page}
"""
    
    # 결과에 설명 추가
    final_result = result + f"\n<div class='mt-8 p-6 bg-yellow-100 rounded-lg text-xl text-black font-black border-2 border-black'>{explanation}</div>"
    
    return final_result

# 태그 기반 문제 추천 함수 수정 - offset 추가로 페이지 기능 강화
def recommend_tag_based_problems(average_tier, solved_problems, solved_problems_with_details, page=1):
    """태그 기반으로 문제를 추천합니다."""
    print("태그 기반 문제 추천 시작...")
    
    # 태그 빈도 분석
    user_tags_freq = {}
    for problem in solved_problems_with_details:
        for tag in problem.get("tags", []):
            user_tags_freq[tag] = user_tags_freq.get(tag, 0) + 1
    
    # 사용자가 푼 태그가 없으면 빈 리스트 반환
    if not user_tags_freq:
        print("사용자가 푼 문제에서 태그 정보를 찾을 수 없습니다.")
        return []
    
    # 가장 많이 푼 태그 상위 3개 선택
    top_tags = sorted(user_tags_freq.items(), key=lambda x: x[1], reverse=True)[:3]
    print(f"가장 많이 푼 태그: {[tag[0] for tag in top_tags]}")
    
    # solved_problems를 집합으로 변환
    solved_problems_set = set()
    for problem_id in solved_problems:
        solved_problems_set.add(str(problem_id))
        try:
            solved_problems_set.add(int(problem_id))
        except (ValueError, TypeError):
            pass
    
    # 태그별 티어 범위 설정
    min_tier = max(1, average_tier - 2)
    max_tier = min(10, average_tier + 1)  # 실버 1까지로 제한
    tier_range = f"{min_tier}..{max_tier}"
    
    # 페이지 오프셋 계산 - 페이지마다 다른 문제가 나오도록 함
    offset = (page - 1) * 10
    
    # 각 태그에 대해 문제 검색
    all_tag_problems = []
    for tag, freq in top_tags:
        # 태그별 쿼리 생성
        tag_query = f"*l{tier_range} {tag}"
        
        params = {
            "query": tag_query,
            "sort": "solved",
            "page": page,
            "limit": 100,
            "offset": offset  # 오프셋 추가
        }
        
        print(f"태그 '{tag}' 검색 쿼리: {tag_query} (페이지: {page}, 오프셋: {offset})")
        data = rate_limited_request(PROBLEM_SEARCH_ENDPOINT, params)
        
        # 검색 결과 처리
        if not data or "items" not in data or len(data["items"]) == 0:
            print(f"태그 '{tag}'에 대한 검색 결과가 없습니다.")
            continue
        
        print(f"태그 '{tag}'에 대해 {len(data['items'])}개 문제 찾음")
        
        # 이미 푼 문제와 언레이티드 문제 필터링
        filtered_problems = []
        for item in data["items"]:
            problem_id = str(item["problemId"])
            
            # 이미 푼 문제인지 확인
            if problem_id in solved_problems_set:
                continue
                
            # 언레이티드 문제 건너뛰기
            if item["level"] == 0:
                continue
                
            # 너무 어려운 문제 건너뛰기
            if item["level"] < average_tier - 2:
                print(f"- 건너뜀 (너무 어려움): #{problem_id} [{get_tier_name_ko(item['level'])}] {item['titleKo']}")
                continue
                
            # 문제 정보 구성
            problem = {
                "id": problem_id,
                "title": item["titleKo"],
                "level": item["level"],
                "tags": [tag_info["key"] for tag_info in item.get("tags", [])],
                "solved_count": item.get("solvedCount", 0),
                "score": 70 + (freq / max(user_tags_freq.values())) * 30,  # 태그 빈도에 따른 점수 부여
                "score_details": {
                    "difficulty": 30,
                    "tag_similarity": (freq / max(user_tags_freq.values())) * 50,
                    "popularity": min(20, (item.get("solvedCount", 0) / 500) * 20)
                },
                "recommendation_type": "태그 기반"
            }
            filtered_problems.append(problem)
            if len(filtered_problems) >= 5:  # 각 태그별 최대 5개
                break
        
        all_tag_problems.extend(filtered_problems)
    
    # 점수 기준 정렬 후 상위 2개 반환
    all_tag_problems.sort(key=lambda x: x["score"], reverse=True)
    
    print(f"태그 기반 추천 {len(all_tag_problems)}개 찾음")
    for i, prob in enumerate(all_tag_problems[:5], 1):
        print(f"- 태그 추천 {i}: #{prob['id']} [{get_tier_name_ko(prob['level'])}] {prob['title']}")
    
    # 태그 기반 문제가 없는 경우 백업 태그 검색
    if not all_tag_problems:
        print("일반 태그로 문제를 찾을 수 없어 백업 태그 검색을 시도합니다.")
        return search_backup_tag_problems(average_tier, solved_problems_set, page)
    
    # 정확히 2개 반환
    result = all_tag_problems[:2]
    print(f"최종 태그 기반 추천 문제 수: {len(result)}")
    return result

# 백업 태그 기반 문제 검색 함수 - offset 추가로 페이지 기능 강화
def search_backup_tag_problems(average_tier, solved_problems_set, page=1):
    """인기 있는 일반 태그로 문제를 검색합니다."""
    # 일반적인 인기 태그
    common_tags = ["implementation", "math", "string", "greedy", "dp", "bruteforcing", "graphs"]
    
    # 태그별 티어 범위 설정
    min_tier = max(1, average_tier - 3)
    max_tier = min(10, average_tier + 1)  # 실버 1까지로 제한
    tier_range = f"{min_tier}..{max_tier}"
    
    # 페이지 오프셋 계산
    offset = (page - 1) * 10
    
    # 각 태그에 대해 문제 검색
    all_problems = []
    for tag in common_tags:
        # 태그별 쿼리 생성
        tag_query = f"*l{tier_range} {tag} *o20.."
        
        params = {
            "query": tag_query,
            "sort": "solved",
            "page": page,
            "limit": 50,
            "offset": offset  # 오프셋 추가
        }
        
        print(f"백업 태그 '{tag}' 검색 쿼리: {tag_query} (페이지: {page}, 오프셋: {offset})")
        data = rate_limited_request(PROBLEM_SEARCH_ENDPOINT, params)
        
        # 검색 결과 처리
        if not data or "items" not in data or len(data["items"]) == 0:
            print(f"백업 태그 '{tag}'에 대한 검색 결과가 없습니다.")
            continue
            
        print(f"백업 태그 '{tag}'에 대해 {len(data['items'])}개 문제 찾음")
            
        # 이미 푼 문제 필터링
        for item in data["items"]:
            problem_id = str(item["problemId"])
            
            # 이미 푼 문제인지 확인
            if problem_id in solved_problems_set:
                continue
                
            # 언레이티드 문제 건너뛰기
            if item["level"] == 0:
                continue
                
            # 문제 정보 구성
            problem = {
                "id": problem_id,
                "title": item["titleKo"],
                "level": item["level"],
                "tags": [tag_info["key"] for tag_info in item.get("tags", [])],
                "solved_count": item.get("solvedCount", 0),
                "score": 60,  # 기본 점수
                "score_details": {
                    "difficulty": 30,
                    "tag_similarity": 20,
                    "popularity": 10
                },
                "recommendation_type": "태그 기반"
            }
            all_problems.append(problem)
            if len(all_problems) >= 2:
                break
        
        if len(all_problems) >= 2:
            break
    
    # 실버 이하 기본 문제 검색
    if not all_problems:
        print("백업 태그 검색도 실패. 실버 이하 기본 문제 검색을 시도합니다.")
        return search_basic_problems(solved_problems_set, page)
    
    return all_problems[:2]  # 최대 2개 반환

# 인기도 기반 문제 추천 함수 수정 - offset 추가로 페이지 기능 강화
def recommend_popularity_based_problems(average_tier, solved_problems, solved_problems_with_details, page=1, count=3):
    """인기도(푼 사람이 많은 순) 기준으로 문제를 추천합니다."""
    print(f"인기도 기반 문제 추천 시작... (페이지: {page}, 추천 개수: {count})")
    
    # solved_problems를 문자열과 정수 모두 포함하는 집합으로 변환
    solved_problems_set = set()
    for problem_id in solved_problems:
        solved_problems_set.add(str(problem_id))
        try:
            solved_problems_set.add(int(problem_id))
        except (ValueError, TypeError):
            pass  # 정수로 변환할 수 없는 경우 무시
    
    print(f"사용자가 푼 문제 수: {len(solved_problems)}")
    print(f"중복 제거된 문제 ID 집합 크기: {len(solved_problems_set)}")
    
    # API를 통한 인기 문제 검색으로 대체
    # 기본 브론즈~실버 범위 설정
    min_tier = max(1, average_tier - 2)
    max_tier = min(15, average_tier + 3)  # 골드까지 범위 확장
    tier_range = f"{min_tier}..{max_tier}"
    
    # 페이지 오프셋 계산 - 페이지마다 다른 문제가 나오도록 함
    offset = (page - 1) * 10
    
    # 인기도 기준 쿼리 생성
    popularity_query = f"*l{tier_range} *o500.."  # 최소 500명 이상이 푼 문제
    
    params = {
        "query": popularity_query,
        "sort": "solved",      # 푼 사람이 많은 순으로 정렬
        "page": page,          # 페이지 번호 적용
        "limit": 50,
        "offset": offset       # 오프셋 추가
    }
    
    print(f"인기도 문제 검색 쿼리: {popularity_query} (페이지: {page}, 오프셋: {offset})")
    data = rate_limited_request(PROBLEM_SEARCH_ENDPOINT, params)
    
    # 검색 결과 처리
    if not data or "items" not in data or len(data["items"]) == 0:
        print("인기도 문제 검색 실패")
        return search_common_problems(solved_problems_set, page)
        
    print(f"인기도 문제 검색에서 {len(data['items'])}개 문제 찾음")
    
    # 이미 푼 문제 필터링
    filtered_problems = []
    for item in data["items"]:
        problem_id = str(item["problemId"])
        
        # 이미 푼 문제인지 확인
        if problem_id in solved_problems_set or int(problem_id) in solved_problems_set:
            continue
            
        # 언레이티드 문제 건너뛰기
        if item["level"] == 0:
            continue
            
        # 문제 정보 구성
        solved_count = item.get("solvedCount", 0)
        
        # 기본 태그 추가
        problem_tags = [tag_info["key"] for tag_info in item.get("tags", [])]
        if not problem_tags:
            problem_tags = ["implementation"]
        
        # 점수 계산
        popularity_score = min(60, (solved_count / 10000))  # 10000명당 1점
        tier_bonus = 0
        if average_tier >= 6 and item["level"] >= 6:  # 사용자와 문제가 모두 실버 이상인 경우
            tier_bonus = 20
            
        problem = {
            "id": problem_id,
            "title": item["titleKo"],
            "level": item["level"],
            "tags": problem_tags,
            "solved_count": solved_count,
            "score": 40 + popularity_score + tier_bonus,
            "score_details": {
                "difficulty": 20,
                "tag_similarity": 10,
                "popularity": popularity_score,
                "tier_bonus": tier_bonus
            },
            "recommendation_type": "인기도 기반"
        }
        
        filtered_problems.append(problem)
        print(f"- 추가됨: #{problem_id} [{get_tier_name_ko(item['level'])}] {item['titleKo']} (푼 사람: {solved_count}명)")
        
        if len(filtered_problems) >= count + 5:  # 여유있게 몇 개 더 가져옴
            break
    
    # 인기도(푼 사람 수) 기준 정렬
    filtered_problems.sort(key=lambda x: x["solved_count"], reverse=True)
    
    print(f"인기도 기반 추천 {len(filtered_problems)}개 찾음")
    for i, prob in enumerate(filtered_problems[:count], 1):
        print(f"- 인기도 추천 {i}: #{prob['id']} [{get_tier_name_ko(prob['level'])}] {prob['title']} (푼 사람: {prob['solved_count']}명)")
    
    # 인기도 기반 문제가 없는 경우 기본 문제 검색
    if not filtered_problems:
        print("인기도 기반 문제를 찾을 수 없어 기본 문제 검색으로 전환합니다.")
        return search_common_problems(solved_problems_set, page)
    
    # 요청된 개수만큼 반환 (중요: 원래 요청된 count 개수만큼만 반환)
    result = filtered_problems[:count]
    print(f"최종 인기도 기반 추천 문제 수: {len(result)}")
    return result

# 기본 문제 검색 (실버 이하)
def search_basic_problems(solved_problems_set, page=1):
    """기본적인 실버 이하 문제를 검색합니다."""
    # 기본 브론즈~실버 범위 설정
    tier_range = "1..10"  # 브론즈 5 ~ 실버 1
    
    # 쿼리 생성 (최소 100명 이상이 푼 문제)
    basic_query = f"*l{tier_range} *o100.."
    
    params = {
        "query": basic_query,
        "sort": "solved",  # 푼 사람이 많은 순으로 정렬
        "page": page,      # 페이지 번호 적용
        "limit": 50
    }
    
    print(f"기본 문제 검색 쿼리: {basic_query} (페이지: {page})")
    data = rate_limited_request(PROBLEM_SEARCH_ENDPOINT, params)
    
    # 검색 결과 처리
    if not data or "items" not in data or len(data["items"]) == 0:
        print("기본 문제 검색 실패")
        return []
        
    print(f"기본 문제 검색에서 {len(data['items'])}개 문제 찾음")
    
    # 이미 푼 문제 필터링
    filtered_problems = []
    for item in data["items"]:
        problem_id = str(item["problemId"])
        
        # 이미 푼 문제인지 확인
        if problem_id in solved_problems_set or int(problem_id) in solved_problems_set:
            continue
            
        # 언레이티드 문제 건너뛰기
        if item["level"] == 0:
            continue
            
        # 문제 정보 구성
        solved_count = item.get("solvedCount", 0)
        
        problem = {
            "id": problem_id,
            "title": item["titleKo"],
            "level": item["level"],
            "tags": [tag_info["key"] for tag_info in item.get("tags", [])],
            "solved_count": solved_count,
            "score": 40,  # 기본 점수
            "score_details": {
                "difficulty": 15,
                "tag_similarity": 5,
                "popularity": 20
            },
            "recommendation_type": "인기도 기반"
        }
        filtered_problems.append(problem)
        if len(filtered_problems) >= 5:  # 최대 5개로 증가
            break
    
    return filtered_problems

# 기본적인 추천 문제 검색 (기초 문제)
def search_common_problems(solved_problems_set, page=1):
    """많은 사람들이 푸는 기본 문제를 추천합니다."""
    print(f"기본 문제 추천 시작... (페이지: {page})")
    
    # 자주 풀리는 기본 문제 ID 목록
    common_problems = [
        {"id": "2557", "title": "Hello World", "level": 1},   # 브론즈 5, Hello World 출력
        {"id": "1000", "title": "A+B", "level": 1},           # 브론즈 5, 두 정수 A+B
        {"id": "1001", "title": "A-B", "level": 1},           # 브론즈 5, 두 정수 A-B
        {"id": "10998", "title": "A×B", "level": 1},          # 브론즈 5, 두 정수 A×B
        {"id": "1008", "title": "A/B", "level": 2},           # 브론즈 4, 두 정수 A/B
        {"id": "10869", "title": "사칙연산", "level": 1},     # 브론즈 5, 사칙연산
        {"id": "9498", "title": "시험 성적", "level": 4},     # 브론즈 2, 시험 성적 평가
        {"id": "2753", "title": "윤년", "level": 4},          # 브론즈 2, 윤년 계산
        {"id": "2884", "title": "알람 시계", "level": 3},     # 브론즈 3, 알람 시계
        {"id": "1330", "title": "두 수 비교하기", "level": 1}, # 브론즈 5, 두 수 비교
        {"id": "2741", "title": "N 찍기", "level": 3},        # 브론즈 3, 1부터 N까지 출력
        {"id": "2742", "title": "기찍 N", "level": 3},        # 브론즈 3, N부터 1까지 출력
        {"id": "15552", "title": "빠른 A+B", "level": 4},     # 브론즈 2, 빠른 입출력
        {"id": "10950", "title": "A+B - 3", "level": 3},      # 브론즈 3, 여러 테스트 케이스
        {"id": "10951", "title": "A+B - 4", "level": 3},      # 브론즈 3, EOF까지 입력
        {"id": "2438", "title": "별 찍기 - 1", "level": 3},   # 브론즈 3, 별 패턴
        {"id": "2439", "title": "별 찍기 - 2", "level": 3},   # 브론즈 3, 오른쪽 정렬 별
        {"id": "10952", "title": "A+B - 5", "level": 3},      # 브론즈 3, 0 0 종료 조건
        {"id": "2562", "title": "최댓값", "level": 3},        # 브론즈 3, 최댓값과 위치
        {"id": "3052", "title": "나머지", "level": 4},        # 브론즈 2, 서로 다른 나머지
    ]

    # 사용자가 풀지 않은 문제 필터링
    filtered_problems = []
    
    for problem_data in common_problems:
        problem_id = problem_data["id"]
        
        # 이미 푼 문제인지 확인
        if problem_id in solved_problems_set:
            print(f"- 건너뜀 (이미 풀었음): #{problem_id} {problem_data['title']}")
            continue
            
        # 문제 정보 구성
        solved_count = 50000  # 기본 인기 문제들은 모두 높은 풀이 수 가정
        
        problem = {
            "id": problem_id,
            "title": problem_data["title"],
            "level": problem_data["level"],
            "tags": ["implementation"],  # 기본 태그
            "solved_count": solved_count,
            "score": 50,  # 기본 점수
            "score_details": {
                "difficulty": 20,
                "tag_similarity": 10,
                "popularity": 20
            },
            "recommendation_type": "인기도 기반"
        }
        filtered_problems.append(problem)
        if len(filtered_problems) >= 5:  # 최대 5개로 증가
            break
    
    print(f"기본 문제 추천 {len(filtered_problems)}개 찾음")
    for i, prob in enumerate(filtered_problems[:5], 1):
        print(f"- 기본 문제 추천 {i}: #{prob['id']} [{get_tier_name_ko(prob['level'])}] {prob['title']}")
    
    # 인기 문제 중에서도 풀린 것이 없다면 가장 기본적인 Hello World 문제 추천
    if not filtered_problems:
        print("기본적인 Hello World 문제를 추천합니다.")
        problem = {
            "id": "2557",
            "title": "Hello World",
            "level": 1,
            "tags": ["implementation"],
            "solved_count": 100000,
            "score": 30,
            "score_details": {
                "difficulty": 10,
                "tag_similarity": 5,
                "popularity": 15
            },
            "recommendation_type": "인기도 기반"
        }
        return [problem]
        
    return filtered_problems[:5]

# 추천 결과 형식화 함수
def format_recommendations(recommendations, average_tier):
    """
    추천 결과를 사용자에게 표시할 포맷으로 변환합니다.
    웹 인터페이스에서 사용하기 좋게 HTML 형식을 포함합니다.
    """
    result = []
    
    result.append(f"<h2 class='text-xl font-bold text-blue-600'>📋 추천 문제 (평균 티어: {get_tier_name_ko(average_tier)})</h2>")
    result.append("<div class='border-t border-gray-300 my-3'></div>")
    
    if not recommendations:
        result.append("<div class='py-4 text-red-500 font-medium'>현재 조건에 맞는 추천 문제를 찾을 수 없습니다.</div>")
        return "\n".join(result)
    
    # 추천 유형별로 그룹화
    tag_based = [p for p in recommendations if p.get("recommendation_type") == "태그 기반"]
    popularity_based = [p for p in recommendations if p.get("recommendation_type") == "인기도 기반"]
    
    # 태그 기반 추천 섹션
    if tag_based:
        result.append("<h3 class='text-lg font-semibold text-blue-600 mt-4'>✨ 태그 기반 추천</h3>")
        result.append("<p class='text-sm text-gray-600 mb-2'>사용자가 많이 푼 태그의 문제를 추천합니다.</p>")
        
        for i, problem in enumerate(tag_based, 1):
            result.append(format_problem_card(problem, i))
    
    # 인기도 기반 추천 섹션
    if popularity_based:
        result.append("<h3 class='text-lg font-semibold text-blue-600 mt-6'>🔥 인기도 기반 추천</h3>")
        result.append("<p class='text-sm text-gray-600 mb-2'>많은 사용자가 푼 인기 있는 문제를 추천합니다.</p>")
        
        for i, problem in enumerate(popularity_based, 1):
            result.append(format_problem_card(problem, i))
    
    return "\n".join(result)

# 문제 카드 포맷팅 헬퍼 함수
def format_problem_card(problem, index):
    """문제 정보를 카드 형태로 포맷팅합니다."""
    tier_name = get_tier_name_ko(problem["level"])
    tags = ", ".join(problem["tags"][:3]) if problem["tags"] else "태그 없음"
    score = problem.get("score", 0)
    score_details = problem.get("score_details", {})
    
    # 점수 세부 정보
    difficulty_score = score_details.get("difficulty", 0)
    tag_score = score_details.get("tag_similarity", 0)
    popularity_score = score_details.get("popularity", 0)
    
    # 티어별 색상 지정
    tier_color = get_tier_color(problem["level"])
    
    result = []
    result.append(f"<div class='problem-card mb-4 p-4 rounded-lg bg-white shadow-md border border-gray-300'>")
    result.append(f"  <div class='flex justify-between items-start'>")
    result.append(f"    <h3 class='text-lg font-medium text-gray-800'>")
    result.append(f"      <span class='inline-block mr-2 px-2 py-1 rounded-md text-white text-sm font-medium' style='background-color: {tier_color};'>{tier_name}</span>")
    result.append(f"      {index}. {problem['title']} <span class='text-gray-600 font-normal'>#{problem['id']}</span>")
    result.append(f"    </h3>")
    result.append(f"    <span class='text-lg font-medium text-gray-700'>{score}점</span>")
    result.append(f"  </div>")
    
    # 푼 사람 수 표시
    solved_count = problem.get("solved_count", 0)
    if solved_count > 0:
        result.append(f"  <div class='mt-1 text-sm text-gray-600'>")
        result.append(f"    <span>푼 사람 수: {solved_count}명</span>")
        result.append(f"  </div>")
    
    # 태그 정보
    result.append(f"  <div class='mt-2'>")
    result.append(f"    <span class='text-gray-700'>태그:</span> ")
    if problem["tags"]:
        for tag in problem["tags"][:3]:
            result.append(f"<span class='inline-block mr-1 px-2 py-0.5 bg-blue-600 rounded-md text-sm text-white'>{tag}</span>")
    else:
        result.append("<span class='text-gray-600'>태그 없음</span>")
    result.append(f"  </div>")
    
    # 문제 링크
    result.append(f"  <div class='mt-3'>")
    result.append(f"    <a href='{BOJ_BASE_URL}/{problem['id']}' target='_blank' class='inline-flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors'>")
    result.append(f"      <svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4 mr-1' fill='none' viewBox='0 0 24 24' stroke='currentColor'>")
    result.append(f"        <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14' />")
    result.append(f"      </svg>")
    result.append(f"      문제 풀기")
    result.append(f"    </a>")
    result.append(f"  </div>")
    
    # 점수 세부 정보
    result.append(f"  <div class='mt-3 text-sm text-gray-600'>")
    result.append(f"    <div class='grid grid-cols-3 gap-2'>")
    result.append(f"      <div>난이도 적합도: <span class='font-medium'>{difficulty_score}</span></div>")
    result.append(f"      <div>태그 유사도: <span class='font-medium'>{tag_score}</span></div>")
    result.append(f"      <div>인기도: <span class='font-medium'>{popularity_score}</span></div>")
    result.append(f"    </div>")
    result.append(f"  </div>")
    result.append(f"</div>")
    
    return "\n".join(result)

# 티어별 색상 함수 추가
def get_tier_color(tier):
    """
    티어 레벨에 따른 색상 코드를 반환합니다.
    """
    if tier == 0:
        return "#495057"  # 언레이티드 (회색)
    elif 1 <= tier <= 5:
        return "#ad5600"  # 브론즈 (갈색)
    elif 6 <= tier <= 10:
        return "#435f7a"  # 실버 (은색)
    elif 11 <= tier <= 15:
        return "#ec9a00"  # 골드 (금색)
    elif 16 <= tier <= 20:
        return "#27e2a4"  # 플래티넘 (민트)
    elif 21 <= tier <= 25:
        return "#00b4fc"  # 다이아몬드 (하늘색)
    elif 26 <= tier <= 30:
        return "#ff0062"  # 루비 (진한 핑크)
    else:
        return "#000000"  # 기타 (검정색)

# 명령줄에서 실행되었을 때의 동작
if __name__ == "__main__":
    # 명령줄 인자 처리
    handle = sys.argv[1] if len(sys.argv) > 1 else None
    page = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 1
    
    if not handle:
        print("사용법: python baekjoon_recommender.py [백준ID] [페이지번호]")
        sys.exit(1)
    
    result = recommend_problems(handle, page)
    print(result) 
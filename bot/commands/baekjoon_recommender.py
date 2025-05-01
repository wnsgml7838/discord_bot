#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
백준 문제 추천 시스템
- solved.ac API를 활용해 사용자의 최근 풀이 기반으로 문제 추천
"""

import requests
import json
from collections import Counter
import sys
import time

# API 엔드포인트
SOLVED_API_BASE = "https://solved.ac/api/v3"
USER_SOLVED_ENDPOINT = f"{SOLVED_API_BASE}/user/solved_problems"
PROBLEM_DETAIL_ENDPOINT = f"{SOLVED_API_BASE}/problem/show"
PROBLEM_SEARCH_ENDPOINT = f"{SOLVED_API_BASE}/search/problem"
BOJ_BASE_URL = "https://boj.kr"

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
    params = {"handle": handle}
    data = rate_limited_request(USER_SOLVED_ENDPOINT, params)
    
    if data is None:
        return []
    
    # 문제 ID 목록 반환
    return [item["problemId"] for item in data["items"]]

# 문제 상세 정보 가져오기
def get_problem_details(problem_id):
    params = {"problemId": problem_id}
    data = rate_limited_request(PROBLEM_DETAIL_ENDPOINT, params)
    
    if data is None:
        return None
    
    # 문제 상세 정보 반환
    return {
        "id": data["problemId"],
        "title": data["titleKo"],
        "level": data["level"],
        "tags": [tag["key"] for tag in data["tags"]]
    }

# 추천 문제 검색
def search_problems_by_tag(tag, solved_problems, level_range=None):
    # level_range: [min_level, max_level]
    query = f"tag:{tag} solvable:true"
    
    # 난이도 범위 추가
    if level_range:
        query += f" *s{level_range[0]}..{level_range[1]}"
    
    params = {
        "query": query,
        "sort": "random",
        "page": 1,
        "limit": 20
    }
    
    data = rate_limited_request(PROBLEM_SEARCH_ENDPOINT, params)
    
    if data is None or "items" not in data:
        return []
    
    # 이미 푼 문제 제외
    recommended = []
    for item in data["items"]:
        if item["problemId"] not in solved_problems:
            recommended.append({
                "id": item["problemId"],
                "title": item["titleKo"],
                "level": item["level"]
            })
    
    return recommended

# 메인 함수
def recommend_problems(handle, recent_count=10, recommend_count=3):
    print(f"🔍 '{handle}'님의 백준 문제 추천을 시작합니다...")
    
    # 1. 사용자가 푼 문제 가져오기
    solved_problems = get_solved_problems(handle)
    
    if not solved_problems:
        return f"⚠️ '{handle}'님의 정보를 찾을 수 없거나 푼 문제가 없습니다."
    
    # 2. 최근 문제들의 태그 분석
    recent_problems = solved_problems[-recent_count:] if len(solved_problems) > recent_count else solved_problems
    
    # 모든 태그 수집
    all_tags = []
    recent_levels = []
    
    print(f"📊 최근 {len(recent_problems)}개 문제 태그 분석 중...")
    
    for prob_id in recent_problems:
        details = get_problem_details(prob_id)
        if details and "tags" in details:
            all_tags.extend(details["tags"])
            recent_levels.append(details["level"])
    
    if not all_tags:
        return f"⚠️ '{handle}'님의 최근 문제에서 태그 정보를 가져올 수 없습니다."
    
    # 3. 가장 많이 등장한 태그 찾기
    tag_counter = Counter(all_tags)
    top_tags = tag_counter.most_common(2)
    
    # 사용자의 평균 난이도 계산
    avg_level = sum(recent_levels) / len(recent_levels) if recent_levels else 10
    level_range = [max(1, int(avg_level) - 3), min(30, int(avg_level) + 3)]
    
    # 4. 태그 기반 문제 추천
    recommendations = []
    for tag, _ in top_tags:
        rec_problems = search_problems_by_tag(tag, solved_problems, level_range)
        recommendations.extend(rec_problems)
        if len(recommendations) >= recommend_count:
            break
    
    # 충분한 추천을 못했다면 범위를 넓혀서 다시 시도
    if len(recommendations) < recommend_count:
        level_range = [max(1, int(avg_level) - 5), min(30, int(avg_level) + 5)]
        for tag, _ in top_tags:
            rec_problems = search_problems_by_tag(tag, solved_problems, level_range)
            for p in rec_problems:
                if p not in recommendations:
                    recommendations.append(p)
            if len(recommendations) >= recommend_count:
                break
    
    # 5. 결과 포맷팅
    if not recommendations:
        return f"⚠️ '{handle}'님에게 추천할 문제를 찾을 수 없습니다."
    
    # 최대 recommend_count개 추천
    recommendations = recommendations[:recommend_count]
    
    # 출력 생성
    primary_tag = top_tags[0][0] if top_tags else "알 수 없음"
    result = [f"📘 [{handle}]님을 위한 오늘의 추천 문제"]
    result.append(f"[{primary_tag}]을(를) 자주 푸셨네요!")
    
    for rec in recommendations:
        tier = get_tier_name(rec["level"])
        problem_url = f"{BOJ_BASE_URL}/{rec['id']}"
        result.append(f"- [{tier}] {rec['title']} : {problem_url}")
    
    return "\n".join(result)

# 명령줄에서 실행 시
if __name__ == "__main__":
    if len(sys.argv) > 1:
        handle = sys.argv[1]
        result = recommend_problems(handle)
        print(result)
    else:
        print("사용법: python baekjoon_recommender.py <백준_아이디>") 
# Synthetic map positions for the ambulance crew page (frontend/app/crew).
# SYNTHETIC, written by AI. Coordinates are approximate positions of the street addresses used in the calls;
# ambulance positions are made up. Not for real navigation.

HOSPITALS = {
    "sus_lund": dict(name="SUS Lund", detail="Skånes universitetssjukhus, Akutmottagningen", lat=55.7146, lng=13.1953),
    "sus_lund_barn": dict(name="SUS Lund, Barnakuten", detail="Paediatric emergency department", lat=55.7139, lng=13.1972),
    "psyk_lund": dict(name="Psykiatrisk akutmottagning Lund", detail="Psychiatric emergency (ED first if overdose)", lat=55.7131, lng=13.2008),
}

# call_id -> scene address, scene lat/lng, responding ambulance (unit + position) and destination hospital key.
CALL_LOCATIONS = {
    "call_01_classic_chest_pain": dict(address="Vipeholmsvägen 14, Lund", lat=55.6992, lng=13.2047,
                                       unit="AMB 1120", amb_lat=55.7093, amb_lng=13.2210, hospital="sus_lund"),
    "call_02_atypical_mi_woman": dict(address="Södra Esplanaden 9, Lund", lat=55.7012, lng=13.1931,
                                      unit="AMB 1130", amb_lat=55.6905, amb_lng=13.1770, hospital="sus_lund"),
    "call_03_downplaying_cardiac_arrest": dict(address="Kastanjegatan 3, Dalby", lat=55.6662, lng=13.3477,
                                               unit="AMB 1180", amb_lat=55.6780, amb_lng=13.2890, hospital="sus_lund"),
    "call_04_anaphylaxis_restaurant": dict(address="Klostergatan 5, Lund", lat=55.7046, lng=13.1917,
                                           unit="AMB 1110", amb_lat=55.7148, amb_lng=13.1960, hospital="sus_lund"),
    "call_05_stroke_language_barrier": dict(address="Kämnärsvägen 22, Lund (flat 1104)", lat=55.7228, lng=13.1797,
                                            unit="AMB 1140", amb_lat=55.7085, amb_lng=13.1690, hospital="sus_lund"),
    "call_06_panicking_child_seizure": dict(address="Ringvägen 40, Staffanstorp", lat=55.6411, lng=13.2093,
                                            unit="AMB 1160", amb_lat=55.6540, amb_lng=13.1880, hospital="sus_lund_barn"),
    "call_07a_collision_witness": dict(address="Roundabout Getingevägen / Byggmästaregatan, Lund", lat=55.7163, lng=13.2152,
                                       unit="AMB 1150", amb_lat=55.7290, amb_lng=13.2340, hospital="sus_lund"),
    "call_07b_collision_driver": dict(address="Roundabout Getingevägen / Byggmästaregatan, Lund", lat=55.7163, lng=13.2152,
                                      unit="AMB 1150", amb_lat=55.7290, amb_lng=13.2340, hospital="sus_lund"),
    "call_08_hidden_suicide_risk": dict(address="Fjelievägen 7, Lund (apt 3)", lat=55.7179, lng=13.1712,
                                        unit="AMB 1170", amb_lat=55.7040, amb_lng=13.1560, hospital="sus_lund"),
    "call_09_copd_severe_breathing": dict(address="Linero torg 6, Lund (3rd floor)", lat=55.7062, lng=13.2307,
                                          unit="AMB 1190", amb_lat=55.6950, amb_lng=13.2120, hospital="sus_lund"),
    "call_10_mild_rash_no_ambulance": dict(address="Tunavägen 30, Lund", lat=55.7172, lng=13.2015,
                                           unit=None, amb_lat=None, amb_lng=None, hospital=None),
    "call_11_tia_symptoms_resolved": dict(address="Stora Södergatan 52, Lund", lat=55.6986, lng=13.1937,
                                          unit="AMB 1210", amb_lat=55.7110, amb_lng=13.1830, hospital="sus_lund"),
    "call_12_known_epilepsy_recovered": dict(address="Delphi, Tornavägen 1, Lund (room 214)", lat=55.7196, lng=13.2072,
                                             unit="AMB 1220", amb_lat=55.7300, amb_lng=13.1980, hospital="sus_lund"),
}
